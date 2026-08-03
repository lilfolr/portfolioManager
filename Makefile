DB_URL ?= postgresql://postgres:postgres@127.0.0.1:54362/postgres
DENO_IMAGE ?= denoland/deno:latest

.PHONY: help install typecheck lint test check format web build-web ios android \
	db-up db-down db-reset db-status db-diff db-test-rls \
	fn-serve fn-test fn-check

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

# --- Expo client (React Native + react-native-web) -------------------------
#
# Supabase config comes from .env.local; see .env.example and `make db-status`.

install: ## npm install
	npm install

typecheck: ## tsc --noEmit
	npm run typecheck

lint: ## eslint
	npm run lint

test: ## jest
	npm test

check: ## typecheck + lint + jest, the pre-push gate
	$(MAKE) typecheck
	$(MAKE) lint
	$(MAKE) test

format: ## prettier --write
	npx prettier --write "app/**/*.tsx" "src/**/*.{ts,tsx,js}" "__tests__/**/*.{ts,tsx}"

web: ## expo start --web
	npm run web

build-web: ## expo export --platform web
	npm run build:web

ios: ## expo start --ios
	npm run ios

android: ## expo start --android
	npm run android

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

# The CSV import mapper is Deno source but is unit tested under jest (see
# __tests__/csv-*.test.ts and the npm: mapping in jest.config.js) so it runs in
# the default `make test` rather than behind Docker. What jest cannot check is
# that it still compiles under Deno itself, which is what the edge function
# actually runs -- hence this.
fn-check: ## Type-check the edge functions under Deno
	docker run --rm -v "$(CURDIR)/supabase/functions:/functions" -w /functions \
		$(DENO_IMAGE) check _shared/csv/map.ts _shared/csv/profiles/index.ts \
		import-csv/index.ts parcels/index.ts
