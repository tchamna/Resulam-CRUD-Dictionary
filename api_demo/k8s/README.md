K3s manifests

These manifests deploy the apps on a single-node k3s cluster with nginx-ingress.

Prereqs
- k3s installed
- ingress-nginx installed
- images loaded into containerd (k3s) with `k3s ctr images import -`

Steps
1) Create namespace:
   sudo k3s kubectl apply -f k8s/namespace.yaml

2) Create secrets from your env files (api_demo only):
   sudo k3s kubectl -n resulam create secret generic api-demo-env --from-env-file=~/apps/resulam_dictionaries/api_demo/.env

3) Apply workloads:
   sudo k3s kubectl apply -f k8s/api-demo.yaml
   sudo k3s kubectl apply -f k8s/apps.yaml

4) Apply ingress rules:
   sudo k3s kubectl apply -f k8s/ingress.yaml

Notes
- Update the hostnames in `k8s/ingress.yaml` to match your domains.
- Postgres uses a PVC with the default local-path storage class.
