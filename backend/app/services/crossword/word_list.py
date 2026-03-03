from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"
DEFAULT_WORD_FILE = _DATA_DIR / "word_list.txt"


class _TrieNode:
    __slots__ = ("children", "is_end")

    def __init__(self) -> None:
        self.children: Dict[str, "_TrieNode"] = {}
        self.is_end: bool = False


class Trie:
    """
    Compressed trie over uppercase alpha words.

    Key operation: words_matching(pattern) — returns all words whose
    letters match the pattern list, where None means wildcard.

    Example:
        trie.words_matching(['S', None, None, 'E', 'D'])
        → ['SPEED', 'STEED', 'SHRED', ...]
    """

    def __init__(self) -> None:
        self._root = _TrieNode()

    def insert(self, word: str) -> None:
        node = self._root
        for ch in word:
            node = node.children.setdefault(ch, _TrieNode())
        node.is_end = True

    def search(self, word: str) -> bool:
        node = self._root
        for ch in word:
            if ch not in node.children:
                return False
            node = node.children[ch]
        return node.is_end

    def words_matching(self, pattern: List[Optional[str]]) -> List[str]:
        """Return all words that match the pattern (None = any letter)."""
        results: List[str] = []
        self._dfs(self._root, pattern, 0, [], results)
        return results

    def _dfs(
        self,
        node: _TrieNode,
        pattern: List[Optional[str]],
        idx: int,
        current: List[str],
        results: List[str],
    ) -> None:
        if idx == len(pattern):
            if node.is_end:
                results.append("".join(current))
            return

        ch = pattern[idx]
        if ch is None:
            for letter, child in node.children.items():
                current.append(letter)
                self._dfs(child, pattern, idx + 1, current, results)
                current.pop()
        else:
            child = node.children.get(ch)
            if child is not None:
                current.append(ch)
                self._dfs(child, pattern, idx + 1, current, results)
                current.pop()


class WordList:
    """
    Word list backed by a Trie, with optional frequency scoring.

    get_candidates(pattern, theme_words) returns matches ordered:
      1. Theme words (exact set membership)
      2. All other words (alphabetical — frequency data is optional)
    """

    def __init__(self, word_file: Optional[str] = None) -> None:
        self.trie = Trie()
        self._words: set[str] = set()
        path = Path(word_file) if word_file else DEFAULT_WORD_FILE
        self._load(path)

    def _load(self, path: Path) -> None:
        if not path.exists():
            raise FileNotFoundError(
                f"Word list not found at {path}. "
                "Run: python scripts/build_crossword_data.py"
            )
        count = 0
        with open(path) as f:
            for line in f:
                word = line.strip().upper()
                if word and word.isalpha():
                    self.trie.insert(word)
                    self._words.add(word)
                    count += 1
        logger.info("WordList loaded %d words from %s", count, path)

    def is_valid(self, word: str) -> bool:
        return word.upper() in self._words

    def get_candidates(
        self,
        pattern: List[Optional[str]],
        theme_words: Optional[set[str]] = None,
    ) -> List[str]:
        """
        Return all words matching the pattern, theme-first.
        pattern: list of str or None (None = wildcard)
        theme_words: set of uppercase words to prioritize
        """
        matches = self.trie.words_matching(pattern)
        if not theme_words:
            return matches
        theme = [w for w in matches if w in theme_words]
        rest = [w for w in matches if w not in theme_words]
        return theme + rest
