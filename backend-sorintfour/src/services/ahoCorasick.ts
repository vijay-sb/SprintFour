// Aho-Corasick multi-pattern string matcher.
//
// Used to propagate a gazetteer of already-confirmed PII entities across
// the entire corpus in a SINGLE linear pass — O(total text length) — so
// the 47 repeats of a client's name cost zero model inferences. Matching
// is case-insensitive with word-boundary checking to avoid substring
// false positives ("Sand" inside "Sander").

interface ACNode {
  next: Map<string, number>;
  fail: number;
  outputs: number[]; // indexes into patterns[]
}

export interface ACMatch {
  patternIndex: number;
  start: number;
  end: number;
}

const WORD = /[A-Za-z0-9_]/;

export class AhoCorasick {
  private nodes: ACNode[] = [{ next: new Map(), fail: 0, outputs: [] }];
  private patterns: string[] = [];
  private lengths: number[] = [];
  private built = false;

  add(pattern: string): void {
    const norm = pattern.toLowerCase();
    if (!norm) return;
    const index = this.patterns.length;
    this.patterns.push(pattern);
    this.lengths.push(norm.length);

    let node = 0;
    for (const ch of norm) {
      let nxt = this.nodes[node]!.next.get(ch);
      if (nxt === undefined) {
        nxt = this.nodes.length;
        this.nodes.push({ next: new Map(), fail: 0, outputs: [] });
        this.nodes[node]!.next.set(ch, nxt);
      }
      node = nxt;
    }
    this.nodes[node]!.outputs.push(index);
    this.built = false;
  }

  get size(): number {
    return this.patterns.length;
  }

  build(): void {
    const queue: number[] = [];
    const root = this.nodes[0]!;
    for (const child of root.next.values()) {
      this.nodes[child]!.fail = 0;
      queue.push(child);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = this.nodes[current]!;
      for (const [ch, child] of node.next) {
        queue.push(child);
        let fail = node.fail;
        while (fail !== 0 && !this.nodes[fail]!.next.has(ch)) {
          fail = this.nodes[fail]!.fail;
        }
        const target = this.nodes[fail]!.next.get(ch);
        const childFail = target !== undefined && target !== child ? target : 0;
        this.nodes[child]!.fail = childFail;
        this.nodes[child]!.outputs.push(...this.nodes[childFail]!.outputs);
      }
    }
    this.built = true;
  }

  search(text: string, wordBoundary = true): ACMatch[] {
    if (!this.built) this.build();
    const lower = text.toLowerCase();
    const matches: ACMatch[] = [];
    let node = 0;

    for (let i = 0; i < lower.length; i++) {
      const ch = lower[i]!;
      while (node !== 0 && !this.nodes[node]!.next.has(ch)) {
        node = this.nodes[node]!.fail;
      }
      node = this.nodes[node]!.next.get(ch) ?? 0;

      const outputs = this.nodes[node]!.outputs;
      if (outputs.length === 0) continue;

      for (const patternIndex of outputs) {
        const len = this.lengths[patternIndex]!;
        const start = i - len + 1;
        const end = i + 1;
        if (wordBoundary) {
          const before = start > 0 ? lower[start - 1]! : " ";
          const after = end < lower.length ? lower[end]! : " ";
          if (WORD.test(before) || WORD.test(after)) continue;
        }
        matches.push({ patternIndex, start, end });
      }
    }

    return matches;
  }

  patternAt(index: number): string {
    return this.patterns[index]!;
  }
}
