# EC2 + k3s Deployment Diagram

This document captures the current architecture of the EC2 host, including all web
apps you run on the machine and how traffic flows.

## High-level flow

```
User Browser
    |
    |  HTTPS 443 (Let's Encrypt certs on host)
    v
System Nginx (EC2 host)
    |
    |  proxy_pass -> k3s ingress ClusterIP
    v
k3s Ingress (ingress-nginx)
    |
    |  routes by host header
    v
Kubernetes Services (ClusterIP)
    |
    v
Pods (Deployments / StatefulSet)
```

## Concrete EC2 layout (current)

```
EC2 Host: ec2-18-208-117-82.compute-1.amazonaws.com (18.208.117.82)

┌────────────────────────────────────────────────────────────────────────────┐
│ System Nginx (HTTPS termination on host)                                     │
│  - resulam-crud-dictionary.tchamna.com  -> k3s ingress ClusterIP             │
│  - resulam-royalties.tchamna.com        -> (currently docker or k3s)         │
│  - portfolio.tchamna.com                -> (currently docker or k3s)         │
│  - rag.tchamna.com                       -> (currently docker or k3s)         │
│  - africanlanguagelibrary.tchamna.com   -> (currently docker or k3s)         │
│  - idp.tchamna.com                       -> (currently docker or k3s)         │
└────────────────────────────────────────────────────────────────────────────┘
                               |
                               v
┌────────────────────────────────────────────────────────────────────────────┐
│ k3s cluster (single-node, same EC2)                                         │
│                                                                            │
│   ingress-nginx (ClusterIP 10.43.65.1)                                     │
│   ┌──────────────────────────────────────────────────────────────────────┐ │
│   │ Ingress routes                                                        │ │
│   │  - resulam-crud-dictionary.tchamna.com -> api-demo-web service         │ │
│   └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│   Namespace: resulam                                                       │
│   ┌──────────────────────────────────────────────────────────────────────┐ │
│   │ Services / Workloads                                                  │ │
│   │  - api-demo-web (Deployment -> Pod)                                   │ │
│   │  - api-demo-db  (StatefulSet -> Pod + PVC)                            │ │
│   │  - resulam-royalties (Deployment -> Pod)                              │ │
│   │  - portfolio-next (Deployment -> Pod)                                 │ │
│   │  - rag-ai-app (Deployment -> Pod)                                     │ │
│   │  - document-intelligence (Deployment -> Pod)                          │ │
│   └──────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

## Hostname routing (intended)

| Hostname | Target | Notes |
| --- | --- | --- |
| `resulam-crud-dictionary.tchamna.com` | k3s ingress -> `api-demo-web` | Active, HTTPS via host nginx |
| `resulam-royalties.tchamna.com` | docker or k3s | Currently running in Docker; k3s entry exists |
| `portfolio.tchamna.com` | docker or k3s | Currently running in Docker; k3s entry exists |
| `rag.tchamna.com` | docker or k3s | Currently running in Docker; k3s entry exists |
| `document-intelligence` host | docker or k3s | Currently running in Docker; k3s entry exists |

If you want the remaining apps fully moved to k3s, we can:
1) Build/import images into k3s containerd.
2) Update `imagePullPolicy: Never` (local images).
3) Switch the nginx `proxy_pass` for each host to the ingress ClusterIP.
