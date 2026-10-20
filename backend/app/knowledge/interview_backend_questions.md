---
title: "Backend Engineering Technical Interview Questions and Model Answers"
category: "interview_guide"
role: "backend"
source_note: "Comprehensive question bank and evaluation criteria for junior backend engineering interviews."
---

# Backend Engineering Technical Interview Questions and Model Answers

This question bank presents foundational and intermediate questions asked in backend software engineering interviews, accompanied by what a strong, hire-worthy answer must cover.

---

## Question 1: What happens under the hood when a client makes an HTTP request to an API endpoint?

### What a Strong Answer Must Cover:
1. **DNS Resolution**: The browser/client checks local cache, hosts file, and queries recursive DNS resolvers to resolve the hostname into an IP address.
2. **TCP Handshake (SYN, SYN-ACK, ACK)**: Establishes a reliable connection over the IP network.
3. **TLS/SSL Handshake (if HTTPS)**: Negotiates TLS version, exchanges cryptographic certificates, verifies certificate authority (CA) signatures, and derives symmetric session keys.
4. **HTTP Request Transmission**: Client sends request line (Method, URI path, HTTP version), headers (Host, Content-Type, Authorization), and optional request body.
5. **Reverse Proxy and Load Balancing**: Nginx or cloud load balancer terminates TLS, applies rate limits, and forwards the request to an application server worker.
6. **Application Processing**: Web framework (e.g., FastAPI, Express) routes the URI, executes middleware, validates schemas (Pydantic), executes business logic, queries databases, and builds an HTTP response.
7. **HTTP Response Transmission**: Server returns status code (e.g., 200 OK, 400 Bad Request, 500 Internal Server Error), response headers, and serialized body (JSON).

---

## Question 2: Explain database indexing. How does a B-Tree index accelerate queries, and what is the cost of adding indexes?

### What a Strong Answer Must Cover:
1. **Core Mechanism**: Without an index, the database engine must perform a Full Table Scan ($O(n)$ disk reads) checking every row sequentially. An index is a specialized auxiliary data structure that holds sorted key values and pointers to physical table blocks.
2. **B-Tree Structure**: Balanced tree structure with shallow height ($O(\log n)$ traversal). Keeps data sorted, allowing binary search on equality (`=`) and range queries (`>`, `<`, `BETWEEN`).
3. **The Trade-Offs (Cost of Indexing)**:
   - **Write Overhead**: Every `INSERT`, `UPDATE` (on indexed columns), and `DELETE` operation must update both the base table and all corresponding index B-Trees within the transaction.
   - **Storage Overhead**: Indexes consume substantial additional disk and RAM memory.
   - **Best Practice**: Index high-cardinality columns frequently queried in `WHERE`, `JOIN`, and `ORDER BY` clauses; avoid indexing low-cardinality columns (like boolean flags) unless using partial indexes.

---

## Question 3: How does JWT (JSON Web Token) authentication work, and what are its trade-offs compared to session cookies?

### What a Strong Answer Must Cover:
1. **JWT Anatomy**: Three Base64Url-encoded segments separated by dots: `Header` (algorithm and token type), `Payload` (claims: `sub`, `exp`, user ID, role), and `Signature` (cryptographic HMAC or RSA hash of header + payload using a secret key).
2. **Stateless Verification**: The backend verifies authenticity mathematically using the secret key without querying a database or session store on every request, making it easily horizontally scalable.
3. **Trade-Offs and Vulnerabilities**:
   - **Revocation Difficulty**: Because JWTs are stateless, revoking a leaked token before its expiration requires maintaining a token blacklist in Redis, diminishing the stateless advantage.
   - **Payload Overhead**: Larger byte footprint than small session IDs.
   - **Storage Vulnerability**: Storing tokens in browser `localStorage` leaves them exposed to Cross-Site Scripting (XSS). Best stored in `HttpOnly`, `Secure`, `SameSite=Strict` cookies.

---

## Question 4: What is the difference between concurrency and parallelism? How does Python's `asyncio` handle concurrency?

### What a Strong Answer Must Cover:
1. **Concurrency vs Parallelism**:
   - **Concurrency**: Dealing with lots of things at once (structuring a program into independently executing tasks that can interleave).
   - **Parallelism**: Doing lots of things at once (executing multiple tasks simultaneously on multiple physical CPU cores).
2. **Python's GIL (Global Interpreter Lock)**: A mutex that prevents multiple native OS threads from executing Python bytecodes simultaneously, limiting multi-threaded Python programs to one CPU core for CPU-bound tasks.
3. **Asynchronous Cooperative Multitasking (`asyncio`)**:
   - Single-threaded event loop. Tasks explicitly yield control at I/O boundaries (`await db.query()`, `await http.get()`).
   - While one task waits for an I/O network response, the event loop runs other tasks. Highly efficient for network-bound web services with thousands of concurrent connections.
