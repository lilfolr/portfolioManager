CHROME_EXECUTABLE ?= /usr/bin/chromium
WEB_PORT ?= 8765
DB_URL ?= postgresql://postgres:postgres@127.0.0.1:54362/postgres
DENO_IMAGE ?= denoland/deno:latest
ENV_FILE ?= env/local.json

.PHONY: help get analyze test format run run-web build-web clean \
	js-install js-typecheck js-lint js-test js-web js-build-web \
	db-up db-down db-reset db-status db-diff db-test-rls \
	fn-serve fn-test

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

run: ## flutter run (device picker), reads Supabase config from $ENV_FILE
	flutter run --dart-define-from-file=$(ENV_FILE)

run-web: ## flutter run -d chrome on $WEB_PORT (default 8765), reads Supabase config from $ENV_FILE
	CHROME_EXECUTABLE=$(CHROME_EXECUTABLE) flutter run -d chrome --web-port=$(WEB_PORT) --dart-define-from-file=$(ENV_FILE)

build-web: ## flutter build web --release, reads Supabase config from $ENV_FILE
	flutter build web --release --dart-define-from-file=$(ENV_FILE)

clean: ## flutter clean
	flutter clean

# --- Expo client (React Native + react-native-web) -------------------------
#
# These run alongside the Flutter targets above during the migration; the
# Flutter ones are removed once the port is complete. Supabase config comes
# from .env.local (see .env.example), not --dart-define.

js-install: ## npm install
	npm install

js-typecheck: ## tsc --noEmit
	npm run typecheck

js-lint: ## eslint
	npm run lint

js-test: ## jest
	npm test

js-web: ## expo start --web
	npm run web

js-build-web: ## expo export --platform web
	npm run build:web

# --- Backend (Supabase: Postgres + RLS + Edge Functions) -------------------
#
# `supabase start` manages its own docker compose stack under the hood
# (from supabase/config.toml) -- these targets wrap the CLI rather than
# vendoring a compose file we'd then have to maintain against upstream.
# Ports are shifted off the Supabase defaults in config.toml to avoid
# clashing with other local Supabase projects on this machine.

db-up: ## Start the local Supabase stack (Postgres, auth, PostgREST, Studio)
	supabase start

db-down: ## Stop the local Supabase stack
	supabase stop

db-reset: ## Drop and recreate the local DB, replaying migrations + seed.sql
	supabase db reset

db-status: ## Show local Supabase URLs and keys
	supabase status

db-diff: ## Diff the local DB against migrations (schema drift check)
	supabase db diff

db-test-rls: ## Run the RLS negative test suite (see supabase/tests/rls_negative.sql)
	psql "$(DB_URL)" -f supabase/tests/rls_negative.sql

fn-serve: ## Serve edge functions locally; hot-reloads on save
	supabase functions serve

fn-test: ## Run the parcel engine test suite (supabase/functions/_shared/engine)
	docker run --rm -v "$(CURDIR)/supabase/functions:/functions" -w /functions \
		$(DENO_IMAGE) test _shared/engine/
