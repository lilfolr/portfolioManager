CHROME_EXECUTABLE ?= /usr/bin/chromium
WEB_PORT ?= 8765

.PHONY: help get analyze test format run run-web build-web clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

get: ## flutter pub get
	flutter pub get

analyze: ## flutter analyze
	flutter analyze

test: ## flutter test
	flutter test

format: ## dart format lib test
	dart format lib test

run: ## flutter run (device picker)
	flutter run

run-web: ## flutter run -d chrome on $WEB_PORT (default 8765)
	CHROME_EXECUTABLE=$(CHROME_EXECUTABLE) flutter run -d chrome --web-port=$(WEB_PORT)

build-web: ## flutter build web --release
	flutter build web --release

clean: ## flutter clean
	flutter clean
