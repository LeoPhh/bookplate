#!/bin/sh
set -eu

# Keep the image's original node identity unless the operator supplies IDs.
PUID=${PUID-1000}
PGID=${PGID-1000}
export PUID PGID

# Reject names, root, leading zeroes and values outside Linux's usable ID range.
for value in "$PUID" "$PGID"; do
  case "$value" in
    ''|0*|*[!0-9]*) echo 'PUID and PGID must be integers between 1 and 2147483647.' >&2; exit 1 ;;
  esac
  if [ "${#value}" -gt 10 ] || [ "$value" -gt 2147483647 ]; then
    echo 'PUID and PGID must be integers between 1 and 2147483647.' >&2
    exit 1
  fi
done

# Only root can prepare ownership before switching to the app's identity.
if [ "$(id -u)" = 0 ]; then
  # Update image-owned app resources for custom IDs; skip symlinks and targets.
  find /app ! -type l -exec chown -h "$PUID:$PGID" {} +
  # S3 needs no local uploads; other mounts (such as LEGAL_DIR) stay untouched.
  if [ "${STORAGE:-local}" = local ]; then
    uploads=${UPLOADS_DIR:-/data/uploads}
    # Resolve relative paths from /app, then resolve symlinks before checking safety.
    uploads=$(node -e 'process.stdout.write(require("node:path").resolve(process.argv[1]))' "$uploads")
    mkdir -p "$uploads"
    uploads=$(node -e 'process.stdout.write(require("node:fs").realpathSync(process.argv[1]))' "$uploads")
    # Refuse broad ownership changes caused by an accidental configuration.
    case "$uploads" in
      /|/app|/usr|/etc|/var|/bin|/sbin|/lib|/proc|/sys|/dev|/run|/tmp|/home)
        echo 'UPLOADS_DIR must name a dedicated uploads directory.' >&2; exit 1 ;;
    esac
    # Repair existing volumes and bind mounts; bind mounts also change host files.
    find "$uploads" ! -type l -exec chown -h "$PUID:$PGID" {} +
    # Give the owner access without broadening group or other permissions.
    find "$uploads" -type d -exec chmod u+rwx {} +
    find "$uploads" -type f -exec chmod u+rw {} +
  fi
  # Replace this shell with the unprivileged command so signals reach it directly.
  exec su-exec "$PUID:$PGID" "$@"
fi

# Explicit --user deployments manage their own mounted-directory permissions.
exec "$@"
