# Build on the same architecture it will run on. Oracle's Always Free tier is
# Ampere, so this image is arm64; Coolify builds it on the VPS itself, which
# makes that automatic.
FROM golang:1.26-alpine AS build
WORKDIR /src

# Dependencies first: this layer is reused whenever only source changes.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# CGO off and the symbol table stripped give a static binary of around 10 MB
# with no runtime to install beside it.
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# distroless rather than alpine: no shell, no package manager, nothing to
# exploit if the process is ever compromised. It carries CA certificates, which
# the JWKS fetch over HTTPS needs.
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /
COPY --from=build /out/server /server
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/server"]
