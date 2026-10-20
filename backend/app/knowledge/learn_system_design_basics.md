---
title: "Foundational System Design, Scalability, and Distributed Architectural Patterns"
category: "learning_path"
role: "backend"
source_note: "Curated learning guide for system design fundamentals, caching, load balancing, and distributed patterns."
---

# Foundational System Design, Scalability, and Distributed Architectural Patterns

System design is the process of defining the architecture, modules, interfaces, and data flow for a software system to satisfy specified business requirements while ensuring scalability, reliability, maintainability, and security.

## Core Architectural Concepts

### 1. Vertical vs Horizontal Scaling
- **Vertical Scaling (Scale-Up)**: Adding more CPU, RAM, or faster storage to a single server instance. Limited by hardware physical ceilings and single points of failure.
- **Horizontal Scaling (Scale-Out)**: Adding more server nodes to an application cluster behind a load balancer. Requires stateless application services so any node can serve incoming requests.

### 2. Load Balancing Strategies
- **Role**: Distributes incoming client traffic across healthy backend server instances.
- **Algorithms**: Round Robin, Weighted Round Robin, Least Connections, IP Hash (for sticky sessions).
- **Health Checks**: Continuously probes server endpoints (`/api/health`) and automatically routes traffic away from degraded or unresponsive instances.

### 3. Caching Strategies and Invalidation
- **Caching Tiers**: Browser cache, Content Delivery Network (CDN) edge cache, reverse proxy (Nginx), and distributed in-memory cache (Redis / Memcached).
- **Patterns**:
  - *Cache-Aside (Lazy Loading)*: Application checks cache first; on a miss, reads from database, populates cache, and returns data.
  - *Write-Through*: Application writes to cache and database concurrently.
  - *Write-Behind (Write-Back)*: Application writes to cache immediately; cache asynchronously writes batches to database.
- **Eviction Policies**: Least Recently Used (LRU), Least Frequently Used (LFU), and Time-To-Live (TTL) expiration.

### 4. Database Sharding and Replication
- **Replication**: Primary-Replica (Leader-Follower) architecture where the primary node handles writes and replicas asynchronously stream replication logs to serve read queries.
- **Sharding (Horizontal Partitioning)**: Splitting a large dataset across multiple distinct database instances using a shard key (e.g., user ID hash). Solves storage exhaustion and write throughput limits.

### 5. Message Queues and Asynchronous Decoupling
- **Role**: Decouples producer systems from consumer systems. Buffers spikes in traffic and prevents upstream service failures from cascading downstream.
- **Technologies**: RabbitMQ, Apache Kafka, AWS SQS, Celery with Redis.

### 6. The CAP Theorem
- In any distributed data store, you can guarantee at most two of the following three guarantees during a network partition:
  - **Consistency (C)**: Every read receives the most recent write or an error.
  - **Availability (A)**: Every non-failing node returns a response, but it may not be the most recent write.
  - **Partition Tolerance (P)**: The system continues to operate despite arbitrary network message loss or delay.

---

## Recommended Free Official Resources

- **System Design Primer by Donne Martin (GitHub)**: World-renowned open-source curriculum explaining scalable system architectures with diagrams and trade-off comparisons.
- **High Scalability Articles (highscalability.com)**: Real-world engineering architecture case studies from tech companies detailing scale challenges.
- **AWS Architecture Center - Well-Architected Framework**: Official whitepapers on operational excellence, security, reliability, performance efficiency, and cost optimization.

---

## Practical Architectural Exercise: URL Shortener System Design (Bitly Clone)

### Key Design Challenges
1. **Capacity Estimation**: Estimating write queries per second (QPS), read QPS (typically 10:1 to 100:1 read-to-write ratio), and storage capacity over 5 years.
2. **Short Hash Generation**: Converting a 64-bit integer into Base62 characters (`[a-zA-Z0-9]`) producing 7-character short codes ($62^7 \approx 3.5 \text{ trillion}$ unique combinations).
3. **Redirection Handling**: Returning HTTP 301 (Permanent Redirect - browser caches redirect) vs HTTP 302 (Found / Temporary Redirect - request always hits backend, enabling analytics tracking).
4. **Caching Strategy**: Caching top 20% of trending short URLs in Redis with LRU eviction to serve 80% of read traffic directly from RAM.
