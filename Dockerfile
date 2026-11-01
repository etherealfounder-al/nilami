# One image, one process: the Go binary serves the API, the public pages and
# the admin app, with Postgres beside it.
#
# The build context is the repository root rather than api/, because the image
# needs the admin app's source and the page templates Tailwind has to scan to
# know which classes to emit, neither of which is inside the Go module.
#
# Each stage runs on the builder's own architecture and Go cross-compiles, so
# building an arm64 image on an amd64 runner needs no emulation. Building on
# the VPS itself also works, where the two are the same.

FROM --platform=$BUILDPLATFORM node:24-alpine AS web
WORKDIR /build
RUN corepack enable

# Dependencies first, so this layer survives a change to the application.
COPY web/package.json web/pnpm-lock.yaml ./web/
# No dependency's install scripts run while building this image. pnpm 11
# refuses an install outright when a package wants one, and esbuild is the
# only package here that does — its postinstall fetches a platform binary it
# also ships as an optional dependency, so the build produces identical
# output without it. Verified, not assumed.
RUN cd web && pnpm install --frozen-lockfile --ignore-scripts

COPY web/ ./web/
# Tailwind emits only the classes it can see, and half of them are in the Go
# templates. Without this the pages come out with the right words and no
# layout at all.
COPY api/internal/web/templates/ ./api/internal/web/templates/
RUN cd web && pnpm build


FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS build
ARG TARGETOS=linux TARGETARCH
WORKDIR /src

COPY api/go.mod api/go.sum ./
RUN go mod download

COPY api/ ./
# The built admin app, embedded into the binary. It replaces the .gitkeep that
# keeps the embed valid on a fresh checkout.
COPY --from=web /build/web/dist/ ./internal/web/dist/

# CGO off and the symbol table stripped: a static binary with nothing to
# install beside it.
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server


# distroless rather than alpine: no shell, no package manager, nothing to
# exploit if the process is ever reached. It carries CA certificates, which
# the presigned-upload calls to object storage need.
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /
COPY --from=build /out/server /server
EXPOSE 8080
USER nonroot:nonroot
# The binary is its own probe: there is no shell or curl in here to run one.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["/server", "-healthcheck"]
ENTRYPOINT ["/server"]
