FROM postgres:16

ARG WALG_VERSION=2.0.1

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && curl -L "https://github.com/wal-g/wal-g/releases/download/v${WALG_VERSION}/wal-g-pg-ubuntu-20.04-amd64.tar.gz" \
    | tar -xz -C /usr/local/bin wal-g \
  && chmod +x /usr/local/bin/wal-g \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

COPY archive_wal.sh /usr/local/bin/archive_wal.sh
COPY restore_wal.sh /usr/local/bin/restore_wal.sh
RUN chmod +x /usr/local/bin/archive_wal.sh /usr/local/bin/restore_wal.sh
