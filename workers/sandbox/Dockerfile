# The cloud execution plane's container image.
#
# Base image ships Python 3.11, Node 20, git, curl and the sandbox control-plane
# process. Everything added here is a tool the build's own capabilities need in
# the cloud that the Mac bridge used to provide locally.
#
# Keep this lean: image size is charged against the 50 GB per-account image
# budget and every megabyte is cold-start latency on a new container.
FROM docker.io/cloudflare/sandbox:0.12.9

RUN apt-get update \
 && apt-get install -y --no-install-recommends jq ripgrep sqlite3 unzip \
 && rm -rf /var/lib/apt/lists/*

EXPOSE 3000
