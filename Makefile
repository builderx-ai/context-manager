SHELL := /bin/bash
.PHONY: help build test pack e2e docker-e2e down clean

DEFAULT_IMAGE := node:18-bullseye

help:
	@echo "Makefile targets:"
	@echo "  build        - compile TypeScript (runs npm run build)"
	@echo "  test         - run repository tests (npm test)"
	@echo "  pack         - create a local package tarball (npm pack)"
	@echo "  e2e          - run end-to-end tests inside a Docker container"
	@echo "  docker-e2e   - run the e2e script inside a disposable Docker container"
	@echo "  down         - remove ephemeral artifacts (tmp-e2e, *.tgz)"
	@echo "  clean        - remove build and node artifacts"

build:
	npm run build

test:
	npm test

pack:
	npm pack

# Run e2e tests inside a disposable Docker container. The container mounts the
# repository and runs `ci/run_e2e.sh` which performs build, pack and smoke tests.
docker-e2e:
	docker run --rm -v "$(PWD)":/workspace -w /workspace $(DEFAULT_IMAGE) \
		bash -lc "bash ci/run_e2e.sh"

e2e: build pack docker-e2e

down:
	rm -rf tmp-e2e *.tgz || true

clean:
	rm -rf node_modules dist tmp-e2e *.tgz || true
