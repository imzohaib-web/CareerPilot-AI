---
title: "Cloud Infrastructure Fundamentals and Compute Services"
category: "learning_path"
role: "devops"
source_note: "Curated learning guide for cloud computing concepts, virtualization, serverless architectures, and cloud providers."
---

# Cloud Infrastructure Fundamentals and Compute Services

Cloud computing delivers on-demand computing services—including servers, storage, databases, networking, software, and analytics—over the internet ("the cloud") with pay-as-you-go pricing, elastic scalability, and global availability.

## Core Cloud Service Models

### 1. Infrastructure as a Service (IaaS)
- **Concept**: Renting raw physical or virtualized hardware, storage, and networking primitives. The user is responsible for managing the operating system, runtime, middleware, and application code.
- **Examples**: Amazon EC2, Google Compute Engine, Alibaba Cloud Elastic Compute Service (ECS), Azure Virtual Machines.

### 2. Platform as a Service (PaaS) and Container Runtimes
- **Concept**: Cloud vendor manages the underlying operating system, scaling, patch management, and networking; developers simply deploy application code or Docker containers.
- **Examples**: Google Cloud Run, AWS App Runner, Render, Railway, Heroku.

### 3. Serverless / Function as a Service (FaaS)
- **Concept**: Event-driven execution where code runs in stateless, short-lived containers initialized on demand. Zero compute cost when idle.
- **Examples**: AWS Lambda, Google Cloud Functions, Cloudflare Workers.

---

## Core Cloud Architectural Pillars

### 1. Identity and Access Management (IAM)
- **Principle of Least Privilege**: Users, services, and workloads should be granted only the minimal permissions necessary to perform their required tasks.
- **Roles and Service Accounts**: Using short-lived temporary credentials rather than permanent root API access keys.

### 2. Virtual Private Clouds (VPC) and Networking
- **Subnets**: Public subnets (accessible via Internet Gateway for load balancers) versus Private subnets (no direct inbound internet access; databases and internal microservices live here).
- **Security Groups and Network ACLs**: Virtual firewalls controlling allowed inbound and outbound protocols, ports, and IP CIDR ranges.

### 3. Object Storage vs Block Storage
- **Object Storage**: Storing unstructured files (images, backups, static web assets) identified by a key within a bucket. Scales virtually infinitely via HTTP APIs (Amazon S3, Google Cloud Storage, Alibaba Cloud OSS).
- **Block Storage**: High-performance virtual hard drives attached directly to a specific compute instance (Amazon EBS, Alibaba Cloud Disk) for operating system roots and databases.

---

## Recommended Free Official Resources

- **AWS Skill Builder & Cloud Practitioner Essentials**: Free official foundational video course provided by Amazon Web Services.
- **Google Cloud Skills Boost - Cloud Digital Leader Free Track**: Foundational modules on cloud architecture, Google Cloud products, and security models.
- **Alibaba Cloud Academy**: Free introductory training paths on cloud infrastructure, container services, and network security.

---

## Portfolio Project Idea: Serverless Image Transformation Pipeline

### Overview
Build an automated cloud-native image processing pipeline that accepts user-uploaded images, stores them in cloud object storage, triggers an automated image resizing worker, and serves optimized WebP images globally.

### Key Deliverables
- **Object Storage Bucket**: Configure an object storage bucket (e.g., S3 or compatible MinIO instance) with secure CORS rules.
- **Event-Driven Worker / Function**: Set up a background worker or serverless function triggered automatically on new image uploads that generates thumbnails (e.g., 200x200, 800x800) using Pillow.
- **Metadata Database**: Record the image URL, dimensions, and author in a PostgreSQL or MongoDB database.
- **Presigned URLs**: Implement secure presigned URL generation so client browsers upload directly to object storage without burdening the application API server.
