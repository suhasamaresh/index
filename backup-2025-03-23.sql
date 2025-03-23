--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4 (Debian 17.4-1.pgdg120+2)
-- Dumped by pg_dump version 17.4 (Debian 17.4-1.pgdg120+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: suhas
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO suhas;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: suhas
--

COMMENT ON SCHEMA public IS '';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: UserIndexPrefs; Type: TABLE; Schema: public; Owner: suhas
--

CREATE TABLE public."UserIndexPrefs" (
    "userId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    config jsonb NOT NULL,
    "pgCreds" bytea,
    "webhookId" text NOT NULL,
    CONSTRAINT "UserIndexPrefs_config_check" CHECK ((config @? '$."events"[*]?(@."type" == "NFT_BID" || @."type" == "TOKEN_PRICE")'::jsonpath))
);


ALTER TABLE public."UserIndexPrefs" OWNER TO suhas;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: suhas
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO suhas;

--
-- Data for Name: UserIndexPrefs; Type: TABLE DATA; Schema: public; Owner: suhas
--

COPY public."UserIndexPrefs" ("userId", config, "pgCreds", "webhookId") FROM stdin;
391973f5-f9f1-48f3-9218-b9f9da27988b	{"events": [{"type": "NFT_BID"}]}	\\x7661756c743a76313a2f363242357a2f6b4b6233463474754c365543666938585072464b6d554f2f492b78716563794c547a514d4f4d696b4c56513d3d	webhook1
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: suhas
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
a056a282-3b42-43f1-abaa-3029a7821a23	ac75cb5cf349f17d3e7cf6bfe16bb1835a8f18bd07be22130dbc8a576dacc428	2025-03-23 07:22:46.654492+00	20250323071419_init	\N	\N	2025-03-23 07:22:46.541152+00	1
\.


--
-- Name: UserIndexPrefs UserIndexPrefs_pkey; Type: CONSTRAINT; Schema: public; Owner: suhas
--

ALTER TABLE ONLY public."UserIndexPrefs"
    ADD CONSTRAINT "UserIndexPrefs_pkey" PRIMARY KEY ("userId");


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: suhas
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: UserIndexPrefs_webhookId_key; Type: INDEX; Schema: public; Owner: suhas
--

CREATE UNIQUE INDEX "UserIndexPrefs_webhookId_key" ON public."UserIndexPrefs" USING btree ("webhookId");


--
-- Name: UserIndexPrefs; Type: ROW SECURITY; Schema: public; Owner: suhas
--

ALTER TABLE public."UserIndexPrefs" ENABLE ROW LEVEL SECURITY;

--
-- Name: UserIndexPrefs user_isolation; Type: POLICY; Schema: public; Owner: suhas
--

CREATE POLICY user_isolation ON public."UserIndexPrefs" USING ((CURRENT_USER = ("userId")::text));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: suhas
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

