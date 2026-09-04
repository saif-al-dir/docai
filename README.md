### DocAI — Chat with your documents

A full-stack RAG application: upload PDFs, ask questions, get streaming answerswith clickable citations pointing to the exact source passage and page


#### Features

* RAG with real citations — answers cite [1], [2] sources; clicking opensthe retrieved passage with page number and match confidence
* Token-by-token streaming (SSE) through a reverse proxy on shared hosting
* Per-user auth & data isolation — Supabase Auth; every SQL query is scopedby user_id, enforced server-side, not just hidden in the UI
* In-browser PDF ingestion — upload → extract → chunk → embed → pgvector,queryable within seconds
* Rate limiting & usage metering — per-user hourly quota, token counts,estimated cost, and latency per exchange
* CI/CD — GitHub Actions builds and deploys over SSH to self-managed sharedhosting on every push to main


##### Layer	Choice
* App	Next.js 16 (App Router, standalone output)
* Streaming	Vercel AI SDK v5 (useChat + streamText)
* DB	Supabase Postgres + pgvector (HNSW index)
* Auth	Supabase Auth + SSR session cookies
* LLM / embeddings	OpenAI gpt-4o-mini, text-embedding-3-small
* Hosting	(Node 20, Passenger), Let's Encrypt
* CI/CD	Actions


##### 🚀 Live Demo URL:     https://docai.saif1.usermd.net


##### Demo account:   demo@example.com / Password123