---
title: "Data Structures, Algorithms, and Technical Problem Solving Patterns"
category: "learning_path"
role: "general"
source_note: "Curated learning guide for essential data structures, algorithm patterns, and coding interview preparation."
---

# Data Structures, Algorithms, and Technical Problem Solving Patterns

Mastery of foundational data structures and algorithmic paradigms is critical for passing technical screening rounds, writing performant production systems, and diagnosing runtime complexity bottlenecks.

## Core Data Structures and Complexities

| Data Structure | Average Access | Average Search | Average Insertion | Average Deletion | Space Complexity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dynamic Array (List)** | $O(1)$ | $O(n)$ | $O(1)$ amortized | $O(n)$ | $O(n)$ |
| **Hash Map / Dict** | $O(1)$ | $O(1)$ | $O(1)$ | $O(1)$ | $O(n)$ |
| **Singly Linked List** | $O(n)$ | $O(n)$ | $O(1)$ (at head) | $O(1)$ (at head) | $O(n)$ |
| **Binary Search Tree** | $O(\log n)$ | $O(\log n)$ | $O(\log n)$ | $O(\log n)$ | $O(n)$ |
| **Binary Heap (Priority Queue)** | $O(1)$ (peek min/max) | $O(n)$ | $O(\log n)$ | $O(\log n)$ | $O(n)$ |

---

## 7 Essential Algorithmic Patterns for Interviews

### 1. Two Pointers
- **When to Use**: Sorted arrays or strings where you search for pairs or compare characters from outer edges inward.
- **Classic Problems**: Two Sum II (Input array is sorted), Valid Palindrome, Container With Most Water.

### 2. Sliding Window
- **When to Use**: Finding contiguous subarrays or substrings meeting a condition (e.g., maximum sum, distinct characters).
- **Classic Problems**: Longest Substring Without Repeating Characters, Minimum Size Subarray Sum.

### 3. Fast and Slow Pointers (Tortoise and Hare)
- **When to Use**: Detecting cycles in linked lists or finding the midpoint of a list in a single pass.
- **Classic Problems**: Linked List Cycle Detection, Find the Duplicate Number.

### 4. Breadth-First Search (BFS) and Depth-First Search (DFS)
- **When to Use**: Tree and graph traversals. BFS uses a queue ($O(V+E)$) for shortest path in unweighted graphs; DFS uses recursion/stack for topological sorting and connected components.
- **Classic Problems**: Binary Tree Level Order Traversal, Number of Islands, Course Schedule.

### 5. Binary Search
- **When to Use**: Search space is sorted or monotonic (can discard half the search space at each iteration in $O(\log n)$).
- **Classic Problems**: Search in Rotated Sorted Array, Find Peak Element.

### 6. Dynamic Programming (Memoization and Tabulation)
- **When to Use**: Overlapping subproblems with optimal substructure. Top-down uses recursion with a cache dictionary; bottom-up fills an array iteratively.
- **Classic Problems**: Climbing Stairs, Coin Change, Longest Common Subsequence.

### 7. Monotonic Stack
- **When to Use**: Finding the next greater or smaller element in an array in $O(n)$ time.
- **Classic Problems**: Daily Temperatures, Next Greater Element.

---

## Recommended Free Official Resources

- **NeetCode.io (Blind 75 & NeetCode 150)**: Structured, categorized roadmap of high-yield algorithmic problems with clear video explanations.
- **LeetCode (leetcode.com)**: Industry standard platform for practicing coding interview problems.
- **Visualgo.net**: Interactive visual animations illustrating sorting algorithms, binary search trees, and graph algorithms.
- **OpenDSA by Virginia Tech**: Free interactive open-source textbook covering algorithm analysis and data structures.
