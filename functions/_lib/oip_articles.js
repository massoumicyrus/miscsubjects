// Virtual OIP article layer.
// Public, article-native documentation for the Object Invocation Protocol:
// /a/oip -> /api/articles/oip/bundle?format=markdown -> generated system/capability articles.

import {
  buildCapabilityMap,
  buildObjectSelf,
  buildSelfModel,
  objectSelfMarkdown,
} from "./object_contract.js";
import { attachSelf, wrapMarkdown } from "./self_explain.js";
import { buildNowIso } from "./build_time.js";

const BASE = "https://miscsubjects.com";

/** Canonical one-liner — dominates every OIP root/handoff surface. */
export const OIP_CANONICAL_SENTENCE =
  "OIP (Object Invocation Protocol) governs remote execution through scoped, self-describing object contracts: a capable model operates external tools, models, devices, APIs, files, queues, and ledgers by resolving an object, invoking it within scope, and reading the receipt it produces, with replay and repair lineage on every action.";

/** OIP definition block — affirmative, proven in place. Injected into root, handoff, Tap & Go. */
export function oipNotFirewallMarkdown() {
  return [
    "## The operating model",
    "",
    "OIP governs remote execution through scoped, self-describing object contracts. A capable model operates external tools, models, devices, APIs, files, queues, and ledgers by resolving an object, reading its contract, invoking it within scope, and reading the receipt.",
    "",
    "## Invariants",
    "",
    "- An action is an object invocation. Proof: `POST /api/dispatch {key, body}` runs one object.",
    "- Authority equals the object scope carried by the credential. Proof: `GET /api/dispatch?explain=1&share=TOKEN` returns the exact scope.",
    "- Proof of an action is its receipt. Proof: `GET /api/dispatch?receipt=inv_ID` returns the request, the response, and the actor.",
    "- A correction is a repair linked to the receipt it fixes. Proof: `POST /api/dispatch {key, body, repairs:inv_ID}` writes lineage in both directions.",
    "",
    "A caller operates only within the scope stated in its credential. That scope is enforced at the dispatch boundary.",
  ].join("\n");
}

/** The operating loop — described in third person as how the system is used. */
export function oipModelOperatingRuleMarkdown() {
  return [
    "## Operating loop",
    "",
    "The system is used in a short, receipted loop:",
    "",
    "1. Resolve — `?ask=<plain language>` or `?key=<KEY>` returns the matching object.",
    "2. Contract — the object's contract describes its inputs and behavior.",
    "3. Scope — `?explain=1&share=TOKEN` reports what the credential permits.",
    "4. Invoke — invoking the object runs it.",
    "5. Receipt — the response carries `proof.say_to_user`, the human-readable result.",
    "6. Repair — a wrong result is corrected by repairing from its receipt.",
    "",
    "The steps run in order; the first incomplete step reports what it requires.",
  ].join("\n");
}

const KIND_SLUGS = new Set(["apis", "clis", "mcps", "devices", "models", "core"]);
const KIND_LABEL = {
  apis: "API shelves",
  clis: "CLI shelves",
  mcps: "MCP shelves",
  devices: "Device shelves",
  models: "Model shelves",
  core: "Core shelves",
};

// Primer bodies live in D1 (oip_primer_bodies), read via loadPrimerBody(); this index keeps
// only the sync-needed fields (slug/title/machine_schema). Migration 0264. Was ~1MB inline.
export const OIP_PRIMER_ARTICLES = [
  {
    "slug": "oip-protocol-lineage",
    "title": "OIP protocol lineage",
    "machine_schema": {
      "definitions": {
        "remote_operation_protocol": "a standard that makes a class of operation addressable across systems",
        "work_object": "the OIP unit: contract, scope, invocation, receipt, replay, repair",
        "lineage": [
          "RPC",
          "SOAP",
          "REST",
          "gRPC",
          "MCP",
          "OIP"
        ]
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-protocol-lineage",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-protocol-lineage/bundle",
        "receipt": "GET https://miscsubjects.com/api/dispatch?receipt=inv_ID"
      },
      "examples": [
        {
          "description": "Read the protocol lineage",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-protocol-lineage'"
        }
      ],
      "test_questions": [
        "What class of operation does each protocol in the lineage make addressable?",
        "What is the OIP unit, and what does it carry?",
        "What does OIP add to SOAP's place in the line?"
      ],
      "dependencies": [
        "oip",
        "oip-operating-model",
        "oip-mcp"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model list the lineage and state OIP's addition?",
        "english_clarity": "Can a zero-context reader place OIP among remote-operation protocols?",
        "operability": "Can the model name the receipt route that carries an object's proof?"
      }
    }
  },
  {
    "slug": "oip-operating-model",
    "title": "OIP Operating Model",
    "machine_schema": {
      "definitions": {
        "object_invocation_protocol": "a protocol that governs remote execution by treating every action as an invokable object with a contract, a scope, and a receipt",
        "object_contract": "the self-describing document that states what an object does, what input it accepts, how to run it, what output proves it worked, and where to look when it fails",
        "scope": "the boundary of authority carried by a credential, stating which objects a model is permitted to invoke and which it is not",
        "credential": "a time-bound token that carries a declared scope; the model is a temporary operator only for the duration of that credential",
        "receipt": "the proof object that records the request, the response, the actor, and the timestamp of one invocation; it is the only evidence that an action ran",
        "repair": "a correction linked to the receipt it fixes; repairs create bidirectional lineage so the audit trail shows both the error and the fix",
        "dispatch_boundary": "the enforcement layer that checks the credential scope before allowing an object to be invoked; it is where authority is tested against permission",
        "temporary_operator": "a model operating external machinery for the duration of one credential; the model is not the owner of the system, only the current operator within stated bounds",
        "replay_path": "the route that lets any auditor re-run the same invocation with the same inputs to verify the output matches the receipt",
        "repair_path": "the route that lets a correction be submitted against a specific receipt, creating a linked chain of error and fix"
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-operating-model",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-operating-model/bundle",
        "invoke": "POST https://miscsubjects.com/api/dispatch {key, body}",
        "receipt": "GET https://miscsubjects.com/api/dispatch?receipt=inv_ID",
        "explain_scope": "GET https://miscsubjects.com/api/dispatch?explain=1&share=TOKEN",
        "repair": "POST https://miscsubjects.com/api/dispatch {key, body, repairs:inv_ID}"
      },
      "examples": [
        {
          "description": "Read the operating model article",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-operating-model'"
        },
        {
          "description": "Invoke an object and get its receipt",
          "curl": "curl -s -X POST 'https://miscsubjects.com/api/dispatch' -H 'Content-Type: application/json' -d '{\"key\":\"NOW\",\"body\":\"\"}'"
        },
        {
          "description": "Retrieve the receipt for invocation inv_abc123",
          "curl": "curl -s 'https://miscsubjects.com/api/dispatch?receipt=inv_abc123'"
        },
        {
          "description": "Check what scope a credential token permits",
          "curl": "curl -s 'https://miscsubjects.com/api/dispatch?explain=1&share=TOKEN'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article?",
        "What is the main concept of the OIP operating model?",
        "What are the four invariants?",
        "What are the six steps of the operating loop?",
        "What proves that an OIP action actually ran?",
        "How does a correction maintain lineage with the error it fixes?"
      ],
      "dependencies": [
        "oip",
        "oip-what-is-object",
        "oip-ledger-receipts"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model state the four invariants, the six steps, and the exact routes for invoke and receipt?",
        "english_clarity": "Can a zero-context reader explain what an object, a scope, a credential, a receipt, and a repair are, and how they connect?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for invoke, receipt, and explain_scope?"
      }
    }
  },
  {
    "slug": "oip-build-overview",
    "title": "OIP build overview",
    "machine_schema": {
      "definitions": {
        "build": "the whole miscsubjects system",
        "object": "one thing the build can read or do",
        "directory_row": "saved contract for one object",
        "dispatch": "invocation door",
        "runner": "actual machine that does work",
        "ledger": "append-only record",
        "receipt": "proof object for one invocation"
      },
      "routes": {
        "orient": "GET /api/dispatch?orient=1&format=markdown",
        "ask": "GET /api/dispatch?ask=<plain words>",
        "read": "GET /api/dispatch?key=<KEY>&format=markdown",
        "invoke": "POST /api/dispatch {key, body}",
        "receipt": "GET /api/dispatch?receipt=inv_ID&share=TOKEN"
      },
      "examples": [
        {
          "description": "Read the OIP root",
          "curl": "curl 'https://miscsubjects.com/api/dispatch?orient=1&format=markdown'"
        },
        {
          "description": "Ask for an object",
          "curl": "curl 'https://miscsubjects.com/api/dispatch?ask=text+the+owner+hello'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read an object contract?",
        "What is the exact POST body to invoke an object?",
        "How do you prove an invocation ran?"
      ],
      "dependencies": [
        "oip-object-model",
        "oip-directory-dispatch",
        "oip-ledger-receipts"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all 6 routes from the schema?",
        "english_clarity": "Can a zero-context reader explain the 6-step flow?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-object-model",
    "title": "OIP object model",
    "machine_schema": {
      "definitions": {
        "What an object is\",": "What an object is\",",
        "What every object must explain\",": "What every object must explain\",",
        "Human and machine views\",": "Human and machine views\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-object-model",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-object-model/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-object-model/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read OIP object model",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-object-model'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-object-model)?",
        "What is the main concept explained in OIP object model?",
        "What are the three forms of every OIP object?"
      ],
      "dependencies": [
        "oip-build-overview"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-directory-dispatch",
    "title": "Directory rows and dispatch",
    "machine_schema": {
      "definitions": {
        "Directory rows\",": "Directory rows\",",
        "Dispatch\",": "Dispatch\",",
        "Why the row matters\",": "Why the row matters\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-directory-dispatch",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-directory-dispatch/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-directory-dispatch/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read Directory rows and dispatch",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-directory-dispatch'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-directory-dispatch)?",
        "What is the main concept explained in Directory rows and dispatch?"
      ],
      "dependencies": [
        "oip-what-is-object"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-ledger-receipts",
    "title": "Ledger, Receipts, Replay, Repair",
    "machine_schema": {
      "definitions": {
        "ledger": "an append-only record where rows are added and never edited or deleted; the permanent account of what a system did, when it did it, and what happened as a result",
        "append_only": "a storage discipline that prohibits modification or deletion of existing rows; errors are corrected by adding new rows that point back at the originals rather than overwriting them",
        "receipt": "a replayable, third-party-openable record of what was asked, what ran, and what came back; the proof artifact that turns a claimed action into a verifiable one",
        "events_table": "one of two ledger tables in D1 (Cloudflare's SQL database) that stores one row per thing that happened: inbound texts, LLM calls, webhooks, deploys, reviews; columns include id, ts (timestamp), source, key, actor, action, status, trace_id, request_json, and response_json",
        "invocations_table": "the second ledger table in D1 that stores one row per object call; columns include invocation_id, object key, actor fingerprint, input, result, cost, material yield, and lineage columns replay_of, repairs, and repaired_by",
        "trace_id": "a string that groups all rows belonging to one conversation turn, so a single inbound message and every tool call it triggers can be read back as one connected thread",
        "replay": "the operation of re-running a recorded request exactly as it was originally issued, producing a new receipt that carries replay_of pointing back at the original invocation",
        "repair": "the operation of running a corrected call that is explicitly linked to a previous failure, so the failed receipt reads back repaired_by pointing at the fix and the fix carries repairs pointing at the failure",
        "audit_chain": "a hash-chained append-only store where each entry hashes the previous one, so tampering breaks the chain and becomes detectable",
        "proof_artifact": "the replayable, ledgered record of a reasoning event: prompt, inputs, definitions, scope rules, dependencies, evidence references, attacks, repairs, unresolved nodes, conclusion, and the hash that lets any verifier replay every step",
        "capture": "a system state where the institution serves a different principal than the one it declared; under the receipt framework, capture is diagnosed as declared success without openable proof",
        "routes": {
          "read_article": "GET https://miscsubjects.com/a/oip-ledger-receipts",
          "read_bundle": "GET https://miscsubjects.com/api/articles/oip-ledger-receipts/bundle",
          "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-ledger-receipts/bundle?format=markdown",
          "read_receipt": "GET https://miscsubjects.com/api/dispatch?receipt=inv_ID&share=TOKEN",
          "read_invocations": "GET https://miscsubjects.com/api/invocations?limit=10",
          "read_event": "GET https://miscsubjects.com/api/events/<EVENT_ID>",
          "replay_invocation": "POST https://miscsubjects.com/api/dispatch {replay: inv_ID}",
          "repair_invocation": "POST https://miscsubjects.com/api/dispatch {key, body, repairs: inv_FAILED}",
          "verify_rules": "GET https://miscsubjects.com/api/rules/verify"
        },
        "examples": {
          "examples": [
            "description: \"Replay a previous invocation by its ID\""
          ],
          "curl": "curl -X POST 'https://miscsubjects.com/api/dispatch' -H 'Content-Type: application/json' -d '{\\\"replay\\\":\\\"inv_abc123\\\"}'"
        },
        "test_questions": {
          "test_questions": [
            "\"What is the exact URL to read this article?\"",
            "\"What is the main concept explained in Ledger, receipts, replay, repair?\"",
            "\"What is a receipt and how do you read it?\"",
            "\"What is the difference between replay and repair?\"",
            "\"What does append-only mean in the context of the ledger?\"",
            "\"What two tables make up the ledger and what does each store?\""
          ]
        },
        "dependencies": {
          "dependencies": [
            "oip",
            "oip-what-is-object",
            "oip-directory-dispatch",
            "oip-operating-model"
          ]
        },
        "scoring_rubric": {
          "json_clarity": "Can the model identify all routes, definitions, and examples from the machine_schema?",
          "english_clarity": "Can a zero-context reader explain append-only storage, the two ledger tables, receipt format, replay vs repair, and the audit chain without guessing?",
          "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for reading the article, reading invocations, reading a receipt, replaying an invocation, and repairing a failed invocation?"
        }
      }
    }
  },
  {
    "slug": "oip-tap-go",
    "title": "The complete token and capability manual",
    "machine_schema": {
      "definitions": {
        "tap_and_go": "the copy primitive for OIP: one copied artifact that carries every piece a model needs to act and prove action with zero prior context",
        "copy_primitive": "an operation that copies a complete, self-contained capability object from one system to another without loss of function or authority",
        "credential": "a typed, expiring, revocable token that proves the bearer has permission to invoke a specific object within stated bounds",
        "object_map": "a structured directory of all capabilities available to a recipient, showing each object's key, input shape, and authority requirement",
        "search_pattern": "a plain-language query that resolves to one or more object keys through the dispatch system's ask or key resolution",
        "execute_shape": "the exact HTTP request shape required to invoke an object: method, URL, headers, body fields, and expected response",
        "receipt_rule": "the requirement that every invocation produce a replayable, ledgered proof object containing request, response, actor, and lineage",
        "zero_context_test": "the standard that a disclosure is complete only when a recipient with no prior knowledge can run the remedy from what was published",
        "density_law": "the principle that the more a structure self-describes, the less power its interpreters hold; self-description as anti-capture technology",
        "capability_token": "bounded delegation compiled into a single object: scoped, expiring, use-capped, risk-ceilinged, argument-pinnable, instantly revocable, fully ledgered",
        "scope_level": "the boundary of authority carried by a drop: broad owner (full build), prefix-scoped (one capability family), row-scoped (one object), tenant-scoped (one compartment), or action-scoped (one invocation)",
        "article_collaboration_token": "the ordinary OIP token format scoped to pfx:BLOCK_; it can invoke public-content DIV objects but cannot name MCP_, CLI_, COMPUTER_, owner, admin, terminal, or secret capabilities",
        "one_verb_rule": "the interface presents one semantic action such as Edit; public authority queues that edit for owner review, while sufficient scoped authority applies the same edit directly",
        "public_actor": "a human or model with no token; may read, open DIV threads, comment, vote, and submit exact proposed changes without mutating canonical content",
        "minted_actor": "a human or model holding a recorded live capability; may directly invoke only the BLOCK_ objects named by its scope and risk ceiling",
        "transport_grades": "preferred: Authorization Bearer; good: structured POST body; compatibility: short-lived query token or /web/run URL; broad admin authority never belongs in a URL",
        "trust_classes": "canonical content, public commentary, untrusted pending mutation, and privileged instructions/configuration remain distinct; text never becomes authority",
        "proof_object": "every OIP invocation returns an inv_ receipt with object, actor capability fingerprint, request/result hashes, contract fingerprint, confirmation, replay, and repair links"
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-tap-go",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-tap-go/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-tap-go/bundle?format=markdown",
        "public_article_graph": "GET https://miscsubjects.com/api/blocks/article/<slug>",
        "public_comment": "POST https://miscsubjects.com/api/blocks/comment {block_id,body,actor?}",
        "public_proposal": "POST https://miscsubjects.com/api/blocks/suggest {article_slug,block_id,expected_hash,kind,payload,note?,actor?}",
        "invoke_post_body": "POST https://miscsubjects.com/api/dispatch {key:'BLOCK_EDIT',body:'<JSON>',share:'<TOKEN>'}",
        "invoke_bearer": "POST https://miscsubjects.com/api/dispatch with Authorization: Bearer <TOKEN> and JSON {key,body}",
        "invoke_get_compatibility": "GET https://miscsubjects.com/api/dispatch?invoke=BLOCK_EDIT&body=<URL_ENCODED_JSON>&share=<SHORT_LIVED_TOKEN>",
        "invoke_web_model": "GET https://miscsubjects.com/web/run/BLOCK_EDIT?body=<URL_ENCODED_JSON>&share=<SHORT_LIVED_TOKEN>",
        "invoke_capability_token": "POST https://miscsubjects.com/api/dispatch with JSON {key,body,capability_token:'<TOKEN>'}",
        "invoke_x_write_token": "POST https://miscsubjects.com/api/dispatch with x-write-token: <TOKEN> and JSON {key,body}",
        "invoke_x_block_token": "POST https://miscsubjects.com/api/dispatch with x-block-token: <TOKEN> and JSON {key,body}",
        "explain_scope": "GET https://miscsubjects.com/api/dispatch?explain=1&share=TOKEN",
        "validate_token": "GET or POST https://miscsubjects.com/api/token/validate using query share, Bearer, or x-write-token",
        "confirm_receipt": "GET https://miscsubjects.com/api/dispatch?confirm=inv_ID or https://miscsubjects.com/web/confirm/inv_ID",
        "read_receipt": "GET https://miscsubjects.com/api/dispatch?receipt=inv_ID&share=TOKEN",
        "replay": "POST https://miscsubjects.com/api/dispatch {replay:'inv_ID',share:'TOKEN'}",
        "repair": "POST https://miscsubjects.com/api/dispatch {key,body,repairs:'inv_ID',share:'TOKEN'}",
        "mint_article_capability": "OWNER GET https://miscsubjects.com/api/dispatch?tap_go=1&drop=article",
        "mint_one_object": "OWNER GET https://miscsubjects.com/api/dispatch?mint_share=1&scope=row&key=BLOCK_EDIT&ttl=600&uses=1",
        "root_public_drop": "GET https://miscsubjects.com/start?actor=<MODEL>",
        "public_self_scope": "GET https://miscsubjects.com/api/dispatch?self_scope=1&keys=ARTICLE_INSPECT,OBJECTION_LOG&actor=<MODEL>",
        "narrow_child": "GET https://miscsubjects.com/api/dispatch?narrow=1&share=<PARENT>&scope=row:ARTICLE_INSPECT&ttl=600&uses=1",
        "revoke_tree": "OWNER GET https://miscsubjects.com/api/dispatch?revoke=cap_<FINGERPRINT>",
        "proven_work_inspect": "GET https://miscsubjects.com/api/proven-work/<slug>/inspect",
        "proven_work_certify": "GET or POST https://miscsubjects.com/api/proven-work/<slug>/certify using the inspection receipt and an endorsed verdict",
        "workspace_seat": "GET https://miscsubjects.com/api/workspace/<slug>/enter?role=<PUBLIC_ROLE>&actor=<MODEL>",
        "write_gate": "GET https://miscsubjects.com/api/write-gate/challenge?slug=<slug>"
      },
      "examples": [
        {
          "description": "Read the canonical token and capability manual",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-tap-go'"
        },
        {
          "description": "Mint a row-scoped capability for one object with 3 uses and 10-minute expiry",
          "curl": "curl -H 'x-terminal-key: <KEY>' 'https://miscsubjects.com/api/dispatch?mint_share=1&scope=row&key=NOW&ttl=600&uses=3'"
        },
        {
          "description": "Explain what a token can do before using it",
          "curl": "curl -s 'https://miscsubjects.com/api/dispatch?explain=1&share=<TOKEN>'"
        },
        {
          "description": "Edit one recursive-content DIV through the preferred curl Bearer lane",
          "curl": "curl -sS -X POST https://miscsubjects.com/api/dispatch -H 'Authorization: Bearer <TOKEN>' -H 'content-type: application/json' -d '{\"key\":\"BLOCK_EDIT\",\"body\":\"{\\\"block_id\\\":\\\"rb_ID\\\",\\\"expected_hash\\\":\\\"HASH\\\",\\\"content\\\":\\\"replacement\\\"}\"}'"
        },
        {
          "description": "Run the same edit from a browser-only model",
          "url": "https://miscsubjects.com/web/run/BLOCK_EDIT?share=<SHORT_LIVED_TOKEN>&body=<URL_ENCODED_JSON>"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-tap-go)?",
        "Why is this the sole source of truth for token use and troubleshooting?",
        "What six components does a Tap & Go drop carry?",
        "What is the difference between a broad owner drop and a row-scoped drop?",
        "What does the density law state about self-describing structures?",
        "What may a visitor do without a token, and what does a pfx:BLOCK_ token add?",
        "How do Bearer, POST-body share, capability_token, query, /web/run, x-write-token, and x-block-token transports resolve to the same capability?",
        "Why can an article token never invoke MCP, CLI, computer, owner, or terminal objects?",
        "Where are the receipt, confirmation, replay, and repair routes?",
        "How do /start, self_scope, owner mint, Tap & Go, workspace seats, and the write-gate challenge differ?",
        "How does the same token grammar reach article DIVs, APIs, CLIs, MCPs, and computer objects without sharing one security domain?",
        "What diagnostic order distinguishes transport refusal, expiry, exhaustion, revocation, scope mismatch, risk refusal, and a stale write?"
      ],
      "dependencies": [
        "oip",
        "oip-what-is-object",
        "oip-what-is-capability",
        "oip-what-is-token",
        "oip-operating-model"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all six components of a drop, all four scope levels, and all routes from the schema?",
        "english_clarity": "Can a zero-context reader explain the copy primitive, the zero-context test, and the density law without guessing?",
        "operability": "Can a zero-context visitor distinguish public proposals from direct token actions, choose the safest transport available, invoke one BLOCK_ object from browser or curl, and return the inv_ receipt plus keyless confirmation without exposing the token?"
      }
    }
  },
  {
    "slug": "oip-machine-json",
    "title": "Machine-native JSON",
    "machine_schema": {
      "definitions": {
        "Why JSON matters\",": "Why JSON matters\",",
        "Prose and JSON\",": "Prose and JSON\",",
        "Rule\",": "Rule\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-machine-json",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-machine-json/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-machine-json/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read Machine-native JSON",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-machine-json'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-machine-json)?",
        "What is the main concept explained in Machine-native JSON?",
        "What is the machine-native rule for OIP objects?"
      ],
      "dependencies": [
        "oip-what-is-object"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-articles-content-plane",
    "title": "Articles and content objects",
    "machine_schema": {
      "definitions": {
        "Content articles\",": "Content articles\",",
        "OIP articles\",": "OIP articles\",",
        "Same pattern, different domain\",": "Same pattern, different domain\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-articles-content-plane",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-articles-content-plane/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-articles-content-plane/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read Articles and content objects",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-articles-content-plane'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-articles-content-plane)?",
        "What is the main concept explained in Articles and content objects?",
        "What is the difference between a peptide article and an OIP article?"
      ],
      "dependencies": [
        "oip-what-is-object"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-files-deploy",
    "title": "Files, repo, and deploy",
    "machine_schema": {
      "definitions": {
        "Operational files\",": "Operational files\",",
        "File objects\",": "File objects\",",
        "Deploy\",": "Deploy\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-files-deploy",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-files-deploy/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-files-deploy/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read Files, repo, and deploy",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-files-deploy'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-files-deploy)?",
        "What is the main concept explained in Files, repo, and deploy?",
        "Where do operational files live vs bulk data?"
      ],
      "dependencies": [
        "oip-what-is-object"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-self-test-proof",
    "title": "Self-test and proof",
    "machine_schema": {
      "definitions": {
        "Self-test\",": "Self-test\",",
        "Proof\",": "Proof\",",
        "Regression\",": "Regression\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-self-test-proof",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-self-test-proof/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-self-test-proof/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read Self-test and proof",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-self-test-proof'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-self-test-proof)?",
        "What is the main concept explained in Self-test and proof?",
        "What is the difference between a description and a proof?"
      ],
      "dependencies": [
        "oip-what-is-object",
        "oip-ledger-receipts"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-operating-playbook",
    "title": "OIP operating playbook",
    "machine_schema": {
      "definitions": {
        "The playbook\",": "The playbook\",",
        "Do not guess\",": "Do not guess\",",
        "Close the loop\",": "Close the loop\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-operating-playbook",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-operating-playbook/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-operating-playbook/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read OIP operating playbook",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-operating-playbook'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-operating-playbook)?",
        "What is the main concept explained in OIP operating playbook?",
        "What is the universal rule for operating the build?"
      ],
      "dependencies": [
        "oip-build-overview"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-api",
    "title": "What is an API?",
    "machine_schema": {
      "definitions": {
        "What this article explains\",": "What this article explains\",",
        "Plain words\",": "Plain words\",",
        "How APIs work in OIP\",": "How APIs work in OIP\",",
        "Machine shape\",": "Machine shape\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-api",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-api/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-api/bundle?format=markdown",
        "invoke": "POST https://miscsubjects.com/api/dispatch {key, body}",
        "read_object": "GET https://miscsubjects.com/api/dispatch?key=<KEY>&format=markdown"
      },
      "examples": [
        {
          "description": "Read What is an API?",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-api'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-api)?",
        "What is the main concept explained in What is an API??",
        "What is the difference between GET and POST in this build?",
        "What headers are required for a POST request?"
      ],
      "dependencies": [
        "oip-what-is-object"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-rest",
    "title": "What is REST?",
    "machine_schema": {
      "definitions": {
        "What this article explains\",": "What this article explains\",",
        "Plain words\",": "Plain words\",",
        "How REST works in this build\",": "How REST works in this build\",",
        "Machine shape\",": "Machine shape\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-rest",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-rest/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-rest/bundle?format=markdown",
        "invoke": "POST https://miscsubjects.com/api/dispatch {key, body}",
        "read_object": "GET https://miscsubjects.com/api/dispatch?key=<KEY>&format=markdown"
      },
      "examples": [
        {
          "description": "Read What is REST?",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-rest'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-rest)?",
        "What is the main concept explained in What is REST??",
        "What does GET do vs POST in REST?",
        "What URL pattern identifies a resource?"
      ],
      "dependencies": [
        "oip-api",
        "oip-what-is-object"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-curl",
    "title": "How to operate the build with curl",
    "machine_schema": {
      "definitions": {
        "What this article explains\",": "What this article explains\",",
        "Read\",": "Read\",",
        "Write or run\",": "Write or run\",",
        "Dispatch\",": "Dispatch\",",
        "Machine shape\",": "Machine shape\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-curl",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-curl/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-curl/bundle?format=markdown",
        "example_read": "curl -s 'https://miscsubjects.com/api/dispatch?orient=1&format=markdown'",
        "example_invoke": "curl -X POST https://miscsubjects.com/api/dispatch -d '{\"key\":\"NOW\",\"body\":\"\"}'"
      },
      "examples": [
        {
          "description": "Read How to operate the build with curl",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-curl'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-curl)?",
        "What is the main concept explained in How to operate the build with curl?",
        "What is the exact curl to read an object?",
        "What is the exact curl to invoke an object?"
      ],
      "dependencies": [
        "oip-api"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-cli",
    "title": "What is a CLI?",
    "machine_schema": {
      "definitions": {
        "What this article explains\",": "What this article explains\",",
        "Plain words\",": "Plain words\",",
        "How CLIs work in OIP\",": "How CLIs work in OIP\",",
        "Machine shape\",": "Machine shape\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-cli",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-cli/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-cli/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read What is a CLI?",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-cli'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-cli)?",
        "What is the main concept explained in What is a CLI??",
        "What is the OIP object for running a shell command?"
      ],
      "dependencies": [
        "oip-what-is-object"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-mcp",
    "title": "What is MCP?",
    "machine_schema": {
      "definitions": {
        "mcp": "Model Context Protocol: a model client connects to a server over a session and the server exposes tools, resources, and prompts.",
        "oip_object_for_mcp": "an MCP tool registered as an OIP directory object with runner type mcp, invoked by URL and recorded by receipt.",
        "containment": "OIP registers a server's MCP tool as one object among its runners and reaches it through a URL.",
        "example_object": "MCP_context7_resolve_library_id"
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-mcp",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-mcp/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-mcp/bundle?format=markdown",
        "compare_mcp_oip": "GET https://miscsubjects.com/a/oip-mcp"
      },
      "examples": [
        {
          "description": "Read What is MCP?",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-mcp'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-mcp)?",
        "What is the main concept explained in What is MCP??",
        "What is the main difference between MCP and OIP?",
        "Does MCP have receipts?"
      ],
      "dependencies": [
        "oip-what-is-object",
        "oip-api"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-github",
    "title": "What is GitHub?",
    "machine_schema": {
      "definitions": {
        "What this article explains\",": "What this article explains\",",
        "Plain words\",": "Plain words\",",
        "How GitHub works in this build\",": "How GitHub works in this build\",",
        "Machine shape\",": "Machine shape\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-github",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-github/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-github/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read What is GitHub?",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-github'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-github)?",
        "What is the main concept explained in What is GitHub??",
        "What is the OIP way to read a GitHub file?"
      ],
      "dependencies": [
        "oip-what-is-object",
        "oip-api"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-github-mcp",
    "title": "What is GitHub MCP?",
    "machine_schema": {
      "definitions": {
        "What this article explains\",": "What this article explains\",",
        "OIP comparison\",": "OIP comparison\",",
        "Machine shape\",": "Machine shape\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-github-mcp",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-github-mcp/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-github-mcp/bundle?format=markdown",
        "compare_mcp_oip": "GET https://miscsubjects.com/a/oip-mcp"
      },
      "examples": [
        {
          "description": "Read What is GitHub MCP?",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-github-mcp'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-github-mcp)?",
        "What is the main concept explained in What is GitHub MCP??",
        "What is the main difference between MCP and OIP?",
        "Does MCP have receipts?"
      ],
      "dependencies": [
        "oip-mcp",
        "oip-github"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-link-structure",
    "title": "OIP link structure",
    "machine_schema": {
      "definitions": {
        "What this article explains\",": "What this article explains\",",
        "Link types\",": "Link types\",",
        "Rule\",": "Rule\",",
        "Machine shape\",": "Machine shape\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-link-structure",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-link-structure/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-link-structure/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read OIP link structure",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-link-structure'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-link-structure)?",
        "What is the main concept explained in OIP link structure?",
        "What makes a link self-explaining?"
      ],
      "dependencies": [
        "oip-what-is-object"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-drop-end-to-end",
    "title": "OIP drop end to end",
    "machine_schema": {
      "definitions": {
        "What this article explains\",": "What this article explains\",",
        "What a drop carries\",": "What a drop carries\",",
        "End to end\",": "End to end\",",
        "Machine shape\",": "Machine shape\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-drop-end-to-end",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-drop-end-to-end/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-drop-end-to-end/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read OIP drop end to end",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-drop-end-to-end'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-drop-end-to-end)?",
        "What is the main concept explained in OIP drop end to end?",
        "What is the end-to-end flow of an OIP drop?"
      ],
      "dependencies": [
        "oip-tap-go"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-cron-recursion",
    "title": "Cron and recursive review",
    "machine_schema": {
      "definitions": {
        "What this article explains\",": "What this article explains\",",
        "OIP review loop\",": "OIP review loop\",",
        "Why one task per tick\",": "Why one task per tick\",",
        "Machine shape\",": "Machine shape\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-cron-recursion",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-cron-recursion/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-cron-recursion/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read Cron and recursive review",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-cron-recursion'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-cron-recursion)?",
        "What is the main concept explained in Cron and recursive review?",
        "What is the KV gate for the review loop?"
      ],
      "dependencies": [
        "oip-build-overview",
        "oip-model-review-loop"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-model-review-loop",
    "title": "Models reviewing OIP articles",
    "machine_schema": {
      "definitions": {
        "What this article explains\",": "What this article explains\",",
        "Questions\",": "Questions\",",
        "Output\",": "Output\",",
        "Machine shape\",": "Machine shape\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-model-review-loop",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-model-review-loop/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-model-review-loop/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read Models reviewing OIP articles",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-model-review-loop'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-model-review-loop)?",
        "What is the main concept explained in Models reviewing OIP articles?",
        "What does a model score when reviewing an OIP article?"
      ],
      "dependencies": [
        "oip-build-overview",
        "oip-model-review-loop"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-spec",
    "title": "The OIP specification — and the proof it is a protocol",
    "machine_schema": {
      "definitions": {
        "protocol": "A system of rules that let independent parties communicate without prior negotiation. A protocol has three mandatory parts: defined message formats, invariants that always hold, and a live conformance test. HTTP, TCP, and SMTP are protocols because they have all three.",
        "object": "A single addressable unit of work. In OIP, an object is a named capability that carries its own contract, input schema, authority requirement, invocation route, runner, proof requirement, and receipt format.",
        "invocation": "The act of sending a request to an object and receiving a result. In OIP v0.6, an invocation is a POST or GET to a uniform route with a key and a body. Every invocation produces a receipt.",
        "receipt": "A machine-readable record that proves one invocation happened. It contains the invocation_id, timestamp, actor, object_key, input_hash, runner, status, output_hash, error when present, and links to ledger, confirm, replay, and repair.",
        "ledger": "An append-only record of every invocation. Nothing is deleted; failures are annotated. The ledger is the forensic backbone of the protocol. It stores request, response, actor, trace, and links.",
        "conformance": "A numbered clause that tests one invariant of the protocol against a live implementation. OIP v1.1.0 defines 27 clauses (C1–C25 core, C26–C27 federation). Each clause is checked by a real HTTP call and produces PASS or FAIL. Cross-domain federation has its own live proof at /api/dispatch?fedtest=1.",
        "replay": "The operation of repeating a recorded invocation from the ledger. A replay uses the original object key and input, produces a new invocation id, and links the new receipt to the original.",
        "repair": "The operation of creating a corrected invocation that references a failed receipt. The repair produces a new receipt and links both directions so failure becomes lineage rather than erasure.",
        "scope": "The credential boundary that limits an object to the authority it was granted. A scoped credential fires one object and is denied everywhere else.",
        "runner": "The system that performs the work when an object is invoked. The runner may be a local script, a remote service, a model, or a worker queue.",
        "deterministic_scaffolding": "The layer of fixed rules, typed contracts, and auditable steps that sits above a stochastic model. The scaffold decides what work to do; the model does the work. The scaffold makes the work provable.",
        "falsification_surface": "A specific claim that, if demonstrated, would collapse part of the structure. An honest protocol names its falsification surfaces. OIP names four: the moral floor, the machine plane, the amortization claim, and the command-plane architecture.",
        "logical_density": "Surety divided by logical energy. Surety is the product of correctness, auditability, reproducibility, and adversarial survival. Logical energy is the total cost of producing and sustaining a proof artifact.",
        "idempotency": "The property that an identical call inside a deduplication window returns the original receipt without performing a second execution.",
        "delegation": "The act of handing a scoped object credential to another model, agent, browser, queue, or service so that party can invoke the object within its scope.",
        "append_only": "The property that a record can be added but never removed or altered. The OIP ledger is append-only. Failures are annotated, not deleted.",
        "routes": {
          "read_article": "GET https://miscsubjects.com/a/oip-spec",
          "read_bundle": "GET https://miscsubjects.com/api/articles/oip-spec/bundle",
          "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-spec/bundle?format=markdown",
          "run_conformance": "GET https://miscsubjects.com/api/dispatch?conformance=1&format=markdown",
          "read_object": "GET https://miscsubjects.com/api/dispatch?key=NOW",
          "invoke_object": "POST https://miscsubjects.com/api/dispatch",
          "read_receipt": "GET https://miscsubjects.com/api/dispatch?receipt=inv_abc123"
        },
        "examples": {
          "examples": [
            "description: \"Invoke the NOW object and receive a receipt\""
          ],
          "curl": "curl -s -X POST 'https://miscsubjects.com/api/dispatch' -H 'Content-Type: application/json' -d '{\\\"key\\\":\\\"NOW\\\",\\\"body\\\":\\\"\\\"}'"
        },
        "test_questions": {
          "test_questions": [
            "\"What is the exact URL to read this article (oip-spec)?\"",
            "\"What are the three things that make something a protocol?\"",
            "\"What is the URL to run the live conformance proof?\"",
            "\"How many conformance clauses does OIP v1.1.0 define?\"",
            "\"What is the difference between replay and repair?\"",
            "\"What is the formula for logical density?\""
          ]
        },
        "dependencies": {
          "dependencies": [
            "oip",
            "oip-what-is-object",
            "oip-operating-model",
            "oip-ledger-receipts"
          ]
        },
        "scoring_rubric": {
          "json_clarity": "Can the model identify all routes, definitions, and examples from the machine_schema?",
          "english_clarity": "Can a zero-context reader explain what a protocol is, what OIP does, and why the 27 clauses matter?",
          "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route and explain the expected result?"
        }
      }
    }
  },
  {
    "slug": "oip-what-is-object",
    "title": "What is an object?",
    "machine_schema": {
      "definitions": {
        "object": "A named, typed, executable thing that the build can read, invoke, or act upon. A file is an object. A shell command is an object. A text message is an object. A database query is an object. A prompt is an object. A receipt is an object.",
        "object_contract": "The complete specification of what an object is, what input it takes, how to invoke it, and what proof it leaves behind. One contract format applies to every object in the system.",
        "three_forms": "Every OIP object exists simultaneously in three forms: (1) a human-readable article, (2) a machine-readable document with routes and schema, and (3) a JSON object with fields and values. The three forms are not translations of each other — they are the same object, viewed from three angles.",
        "invocation": "The act of running an object. An invocation requires a capability (scoped permission), a target (the object key), and an input (arguments or body). Every invocation produces a receipt.",
        "receipt": "An append-only record of what happened when an object was invoked. The receipt contains: timestamp, input, output, status, and any side effects. It is the proof that the invocation occurred and the result it produced.",
        "ledger": "The append-only record of every invocation and event in the system. The ledger is the source of truth for what happened, when, and in what order. It enables replay, repair, and audit.",
        "input_schema": "The declared shape of the data an object accepts. A schema says which fields are required, which are optional, and what type each field must be. Without a schema, the model cannot know what to send.",
        "runner": "The code that executes an object when it is invoked. The runner is the bridge between the object definition (what it is) and the actual work (what it does).",
        "grain": "The directional bias in the space of possible structures. The universe repeatedly converges on the same small family of structural solutions — branching, spiraling, waves, symmetry, flow, critical balance, memory, scale-echo — across every scale and substrate. The grain is not a force or a will; it is a property of the configuration space itself."
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-what-is-object",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-what-is-object/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-what-is-object/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read the 'What is an object?' article as HTML",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-what-is-object'"
        },
        {
          "description": "Read the full machine bundle (article + schema + metadata) as JSON",
          "curl": "curl -s 'https://miscsubjects.com/api/articles/oip-what-is-object/bundle'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article?",
        "What is the main concept explained in this article?",
        "What are the three forms of every OIP object?",
        "Name four example objects in the build and what each one does.",
        "What does every invocation produce?"
      ],
      "dependencies": [
        "oip",
        "oip-build-overview"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-what-is-capability",
    "title": "What is a capability?",
    "machine_schema": {
      "definitions": {
        "What a capability is\",": "What a capability is\",",
        "Why it matters\",": "Why it matters\",",
        "Shapes\",": "Shapes\",",
        "row:KEY": "row:KEY",
        "rows:K1,K2": "rows:K1,K2",
        "pfx:PREFIX": "pfx:PREFIX",
        "act": "act",
        "Fields on every capability\",": "Fields on every capability\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-what-is-capability",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-what-is-capability/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-what-is-capability/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read What is a capability?",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-what-is-capability'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-what-is-capability)?",
        "What is the main concept explained in What is a capability??",
        "What are the four capability shapes?",
        "What is risk_ceiling?"
      ],
      "dependencies": [
        "oip-what-is-object"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-what-is-token",
    "title": "What is a token?",
    "machine_schema": {
      "definitions": {
        "What a token is\",": "What a token is\",",
        "Why it matters\",": "Why it matters\",",
        "What a token looks like\",": "What a token looks like\",",
        "Machine shape\",": "Machine shape\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-what-is-token",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-what-is-token/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-what-is-token/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read What is a token?",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-what-is-token'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-what-is-token)?",
        "What is the main concept explained in What is a token??",
        "What is the difference between a row token and an act token?",
        "How do you revoke a capability?"
      ],
      "dependencies": [
        "oip-what-is-capability"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-what-is-tenant",
    "title": "What is a tenant?",
    "machine_schema": {
      "definitions": {
        "What a tenant is\",": "What a tenant is\",",
        "Why it matters\",": "Why it matters\",",
        "Proof\",": "Proof\",",
        "Machine shape\",": "Machine shape\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-what-is-tenant",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-what-is-tenant/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-what-is-tenant/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read What is a tenant?",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-what-is-tenant'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-what-is-tenant)?",
        "What is the main concept explained in What is a tenant??",
        "What happens when a tenant is suspended?",
        "Can a tenant read another tenant's ledger?"
      ],
      "dependencies": [
        "oip-what-is-capability",
        "oip-what-is-token"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-voxel-graph",
    "title": "What is a voxel graph?",
    "machine_schema": {
      "definitions": {
        "What a voxel graph is\",": "What a voxel graph is\",",
        "Why it matters\",": "Why it matters\",",
        "Machine shape\",": "Machine shape\",",
        "Proof\",": "Proof\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-voxel-graph",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-voxel-graph/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-voxel-graph/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read What is a voxel graph?",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-voxel-graph'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-voxel-graph)?",
        "What is the main concept explained in What is a voxel graph??",
        "What is a node vs an edge in the voxel graph?"
      ],
      "dependencies": [
        "oip-build-overview",
        "oip-what-is-object"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-cookbook",
    "title": "The OIP cookbook — the exact curl for everything",
    "machine_schema": {
      "definitions": {
        "What this article is\",": "What this article is\",",
        "Step zero — get a token (OWNER, do this once)\",": "Step zero — get a token (OWNER, do this once)\",",
        "Read (public — no credentials)\",": "Read (public — no credentials)\",",
        "Act (TOKEN)\",": "Act (TOKEN)\",",
        "Verify (TOKEN)\",": "Verify (TOKEN)\",",
        "Replay and repair (OWNER or act token)\",": "Replay and repair (OWNER or act token)\",",
        "The article system (OWNER)\",": "The article system (OWNER)\",",
        "Token management (OWNER)\",": "Token management (OWNER)\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-cookbook",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-cookbook/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-cookbook/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read The OIP cookbook — the exact curl for everything",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-cookbook'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-cookbook)?",
        "What is the main concept explained in The OIP cookbook — the exact curl for everything?",
        "What is the exact curl to text the owner?",
        "What is the exact curl to read a receipt?"
      ],
      "dependencies": [
        "oip-curl",
        "oip-ledger-receipts"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-mcp-github",
    "title": "What a model sees: MCP GitHub vs the OIP directory",
    "machine_schema": {
      "definitions": {
        "The question this answers\",": "The question this answers\",",
        "MCP GitHub: the wire exchange\",": "MCP GitHub: the wire exchange\",",
        "The same job through OIP\",": "The same job through OIP\",",
        "The honest comparison\",": "The honest comparison\",",
        "See both catalogs live\",": "See both catalogs live\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-mcp-github",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-mcp-github/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-mcp-github/bundle?format=markdown",
        "compare_mcp_oip": "GET https://miscsubjects.com/a/oip-mcp"
      },
      "examples": [
        {
          "description": "Read What a model sees: MCP GitHub vs the OIP directory",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-mcp-github'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-mcp-github)?",
        "What is the main concept explained in What a model sees: MCP GitHub vs the OIP directory?",
        "What is the main difference between MCP and OIP?",
        "Does MCP have receipts?"
      ],
      "dependencies": [],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-mcp-stripe",
    "title": "What a model sees: MCP Stripe vs the OIP directory",
    "machine_schema": {
      "definitions": {
        "The question this answers\",": "The question this answers\",",
        "MCP Stripe: the wire exchange\",": "MCP Stripe: the wire exchange\",",
        "The same capability as OIP rows\",": "The same capability as OIP rows\",",
        "Standing rule on this build\",": "Standing rule on this build\",",
        "The honest comparison\",": "The honest comparison\","
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-mcp-stripe",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-mcp-stripe/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-mcp-stripe/bundle?format=markdown",
        "compare_mcp_oip": "GET https://miscsubjects.com/a/oip-mcp"
      },
      "examples": [
        {
          "description": "Read What a model sees: MCP Stripe vs the OIP directory",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-mcp-stripe'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article (oip-mcp-stripe)?",
        "What is the main concept explained in What a model sees: MCP Stripe vs the OIP directory?",
        "What is the main difference between MCP and OIP?",
        "Does MCP have receipts?"
      ],
      "dependencies": [
        "oip-mcp",
        "oip-stripe"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all routes and definitions from the schema?",
        "english_clarity": "Can a zero-context reader explain the core concept without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for each route?"
      }
    }
  },
  {
    "slug": "oip-convergence-pattern-branching",
    "title": "Branching: The Geometry That Connects Everything",
    "machine_schema": {
      "definitions": {
        "branching": "The geometric solution to connecting a single source to many distributed sinks (or many sources to a single sink) with minimum total cost, subject to a flow constraint. The answer is a hierarchical tree with specific scaling of branch diameters at each bifurcation.",
        "Murray's Law": "r₀³ = r₁³ + r₂³, where r₀ is the radius of the parent vessel and r₁, r₂ are the radii of the daughter branches. The exponent 3 derives from the balance between Poiseuille flow (pressure drop proportional to r⁻⁴) and metabolic cost of vessel maintenance (proportional to r²). Minimizing total cost (pumping + maintenance) yields the cubic relationship.",
        "optimal transport": "The mathematical problem of finding the cheapest way to move a quantity (mass, energy, information) from sources to sinks, subject to constraints on total conduit material, energy dissipation, or both.",
        "Poiseuille flow": "Laminar viscous flow in a cylindrical tube, where the volume flow rate Q = πr⁴ΔP / 8μL. The r⁴ dependence means a small increase in radius produces a large increase in flow capacity.",
        "Horton's laws": "Empirical geomorphological rules stating that stream number and stream length decrease geometrically with stream order in a river network. The ratios are constants that reflect the underlying optimality of the drainage geometry.",
        "constructal law": "Formulated by Adrian Bejan in 1996: 'For a finite-size flow system to persist in time, its configuration must evolve in such a way that provides easier access to the currents that flow through it.' It is a variational principle that predicts branching from optimization alone.",
        "bifurcation ratio": "The ratio of daughter branch diameter to parent branch diameter at a splitting point. For symmetric bifurcation under Murray's Law, this ratio is 2^(-1/3) ≈ 0.794.",
        "convergence instance": "A real-world system in a distinct domain that independently exhibits the same structural pattern, derived from its own local physics with no causal contact with other instances.",
        "WBE model": "The West-Brown-Enquist model (1997) that derives the 3/4 metabolic scaling exponent from optimal branching network geometry, linking network structure to whole-organism metabolic rate.",
        "self-organized criticality": "A dynamical regime where a slowly driven, interaction-dominated system naturally evolves to a critical state where events of all sizes occur, producing power-law statistics. Often abbreviated SOC.",
        "critical seam": "The boundary between frozen order and total randomness, where computation, adaptation, and memory are maximized. Also called the edge of chaos or the critical regime."
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-convergence-pattern-branching",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-convergence-pattern-branching/bundle",
        "read_raw": "GET https://miscsubjects.com/api/file/oip-articles-v2/oip-convergence-pattern-branching.md",
        "list_related": "GET https://miscsubjects.com/api/articles?tag=oip-convergence"
      },
      "examples": [
        {
          "description": "Read the article as rendered HTML",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-convergence-pattern-branching'"
        },
        {
          "description": "Read the full machine bundle (article + metadata + schema)",
          "curl": "curl -s 'https://miscsubjects.com/api/articles/oip-convergence-pattern-branching/bundle'"
        },
        {
          "description": "Read the raw markdown source from the repo",
          "curl": "curl -s 'https://miscsubjects.com/api/file/oip-articles-v2/oip-convergence-pattern-branching.md'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article?",
        "What is Murray's Law and what does it optimize?",
        "Over what scale range does branching as an optimal transport solution appear?",
        "What is the bifurcation ratio for symmetric branching under Murray's Law?",
        "Name three distinct domains where branching geometry appears independently.",
        "What is the difference between branching and mere splitting?"
      ],
      "dependencies": [
        "oip",
        "oip-what-is-object",
        "oip-operating-model",
        "oip-convergence-pattern-bounded-chaos"
      ],
      "scoring_rubric": {
        "json_clarity": "Schema must validate as JSON; all 5 top-level keys present; definitions has at least 8 entries with no circular references; routes are complete HTTPS URLs; examples include at least 2 curl commands with -s flag; test_questions has at least 3 entries; dependencies lists prerequisite slugs; scoring_rubric has 3 fields.",
        "english_clarity": "Every specialized term is defined on first use or inline; no assumed knowledge; all claims carry specific numbers (years, scales, ratios, orders of magnitude); prose is paragraph-based without rigid header templates; a reader with no prior knowledge can follow the argument from start to finish.",
        "operability": "All routes are live and reachable; the article is self-contained and self-explaining; the machine schema is parseable; the file follows the exact frontmatter format (title line, machine_schema block, then body)."
      }
    }
  },
  {
    "slug": "oip-convergence-pattern-bounded-chaos",
    "title": "Pattern 6: Bounded Chaos — The Aliveness Solution",
    "machine_schema": {
      "definitions": {
        "self-organized criticality": "A dynamical regime in which a slowly driven, interaction-dominated system naturally evolves to a critical state where events of all sizes occur, without any external parameter tuning. The system self-tunes to the critical point through the separation of driving and dissipation timescales.",
        "critical seam": "The finite-width zone in the space of dynamical regimes between frozen order and turbulent disorder. Systems operating in this seam exhibit maximal sensitivity, maximal information capacity, and maximal computational capability. It is not a single point but a zone of width approximately 0.1–0.3 in normalized order parameter.",
        "power law": "A statistical distribution in which the probability of an event of size x scales as P(X > x) ~ x^(-α), where α > 0 is the critical exponent. Unlike normal or exponential distributions, power laws have no characteristic scale — events of all sizes occur, with large events rare but not exponentially suppressed.",
        "Lyapunov exponent": "A mathematical quantity λ that measures the rate at which nearby trajectories in a dynamical system diverge or converge. At the critical seam, λ ≈ 0, meaning perturbations neither grow nor decay exponentially. In frozen order, λ < 0; in chaos, λ > 0.",
        "avalanche": "A cascade event in a threshold-activated system, where a local perturbation triggers a chain reaction that propagates through the system. In self-organized criticality, avalanches exhibit power-law size distributions. The term originates from the Bak-Tang-Wiesenfeld sandpile model.",
        "correlation length": "The characteristic distance ξ over which fluctuations in one part of a system influence another part. At criticality, ξ → ∞, meaning system-scale correlations are possible and a perturbation at one location can affect any other location.",
        "renormalization group": "A mathematical framework developed by Kenneth Wilson for extracting universal behavior near critical points. It describes how the properties of a system change under scale transformation, revealing that systems with the same symmetry and dimensionality share identical critical exponents regardless of microscopic details.",
        "universality class": "A category of physical systems that share the same critical exponents and scaling behavior because they have the same symmetry and dimensionality, even if their microscopic physics differs entirely. For example, a fluid near its critical point and a magnetic material near its Curie temperature belong to the same 3D Ising universality class.",
        "edge of chaos": "A phrase coined by Christopher Langton in 1990 to describe the phase transition in cellular automata where computation is maximized. Ordered systems transmit information perfectly but do not compute. Chaotic systems lose information to sensitive dependence. The boundary regime is where information can be stored, transmitted, and modified.",
        "dynamic range": "The ratio between the largest and smallest stimuli a system can discriminate, expressed as DR = log(P_max / P_min). Critical systems maximize dynamic range because their power-law response covers all scales without saturation or threshold exclusion.",
        "threshold activation": "A mechanism in which a system accumulates input slowly until a local variable crosses a critical threshold, triggering a rapid release event. The separation of slow driving and fast response is the physical basis of self-organized criticality.",
        "critical slowing down": "The phenomenon in which a system's recovery time from perturbations diverges as it approaches a critical point. This makes the system sensitive to small influences and is the mathematical basis for responsiveness at the critical seam."
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-convergence-pattern-bounded-chaos",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-convergence-pattern-bounded-chaos/bundle",
        "related": "GET https://miscsubjects.com/api/articles/oip-convergence-pattern-bounded-chaos/related",
        "list": "GET https://miscsubjects.com/api/articles"
      },
      "examples": [
        {
          "description": "Read the article as rendered HTML",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-convergence-pattern-bounded-chaos'"
        },
        {
          "description": "Read the full bundle including machine schema, definitions, and test questions",
          "curl": "curl -s 'https://miscsubjects.com/api/articles/oip-convergence-pattern-bounded-chaos/bundle'"
        },
        {
          "description": "Fetch related articles in the convergence pattern series",
          "curl": "curl -s 'https://miscsubjects.com/api/articles/oip-convergence-pattern-bounded-chaos/related'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article?",
        "What is the main concept of bounded chaos and why is it called the keystone pattern?",
        "What is the scale range of bounded chaos in meters?",
        "Who developed the Bak-Tang-Wiesenfeld sandpile model and in what year?",
        "What is the difference between a power-law distribution and a normal distribution?",
        "What is the critical seam and what four properties does it exhibit?"
      ],
      "dependencies": [
        "oip",
        "oip-what-is-object",
        "oip-operating-model",
        "oip-convergence-pattern-branching"
      ],
      "scoring_rubric": {
        "json_clarity": "The machine_schema must contain all required keys (definitions, routes, examples, test_questions, dependencies, scoring_rubric) with no circular references, no empty values, and valid JSON syntax throughout.",
        "english_clarity": "The article must define every technical term inline, cite specific numbers, years, and scales, and remain comprehensible to a reader with no prior knowledge of the subject. No assumed knowledge. No jargon without definition.",
        "operability": "The article must be reachable at the declared URL, the bundle endpoint must return the full schema and body, and related links must resolve to working articles in the same series."
      }
    }
  },
  {
    "slug": "oip-schools-physics",
    "title": "The Physicists",
    "machine_schema": {
      "definitions": {
        "grain": "The directional bias in the space of possible structures. The universe repeatedly converges on the same small family of structural solutions — branching, spiraling, waves, symmetry, flow, critical balance, memory, scale-echo — across every scale and substrate. The grain is not a force or a will; it is a property of the configuration space itself.",
        "negative_entropy": "The reduction of entropy in a local region, paid for by an increase in entropy in the surrounding environment. A living cell maintains its ordered structure by consuming ordered energy from its food and exporting disordered heat to its surroundings. Also called negentropy.",
        "dissipative_structure": "An ordered structure that persists only because it is continuously dissipating energy. A whirlpool in a bathtub drain is a dissipative structure: it exists only while water is flowing through it. Remove the flow, and the structure vanishes.",
        "symmetry": "A property of a system that remains unchanged under a transformation. A circle has rotational symmetry — it looks the same after any rotation. A square has only four-fold rotational symmetry — it looks the same after 90°, 180°, 270°, and 360° rotations, but not after 45°.",
        "conservation_law": "A principle that a measurable quantity in a closed system does not change over time. Energy is conserved. Momentum is conserved. Angular momentum is conserved. These laws are not imposed from outside; they are consequences of the symmetries of the underlying equations.",
        "variational_principle": "A principle stating that nature chooses the path, state, or configuration that makes some quantity stationary — usually a minimum or maximum. The principle of least action says that a particle moves along the path that minimizes the integral of kinetic minus potential energy over time.",
        "symmetry_breaking": "The phenomenon where a system described by symmetric equations settles into an asymmetric state. A pencil standing vertically on its tip has rotational symmetry, but when it falls, it picks a specific direction and breaks that symmetry. The equations do not change; the solution does.",
        "self_organized_criticality": "A property of slowly driven, interaction-dominated systems that naturally evolve to a critical state without any external tuning. At this critical state, events of all sizes occur, following a power-law distribution. The canonical example is a sandpile: grains are added one by one, and avalanches of all sizes result.",
        "power_law": "A mathematical relationship where the probability of an event of size x scales as P(x) ~ x^(-α), where α is a constant called the exponent. Unlike exponential distributions, power laws have no characteristic scale — events of all sizes occur, with large events rare but not exponentially suppressed.",
        "Landauer_bound": "The minimum thermodynamic energy required to erase one bit of information: k_B T ln(2), where k_B is Boltzmann's constant (~1.38 × 10^-23 J/K) and T is the temperature in kelvin. At room temperature (300 K), this is approximately 2.9 × 10^-21 joules per bit. This is the fundamental cost of irreversible computation.",
        "compressibility": "The ratio between the information content of the complete state of a system and the information content of the rules that generate it. A compressible universe is one where a small set of short laws generates vast complexity. The Standard Model of particle physics requires approximately 10^4 characters to write down; the visible universe contains approximately 10^80 particles.",
        "convergence": "The independent arrival at the same structural solution from different starting points, by different people, in different centuries, working in different domains. When Schrödinger (quantum biology, Dublin, 1944), Prigogine (thermodynamics, Brussels, 1977), and England (statistical mechanics, MIT, 2013) all describe how order emerges from dissipation, this is convergence. It is evidence, not decoration."
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-schools-physics",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-schools-physics/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-schools-physics/bundle?format=markdown"
      },
      "examples": [
        {
          "description": "Read the Physicists article as HTML",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-schools-physics'"
        },
        {
          "description": "Read the full machine bundle (article + schema + metadata) as JSON",
          "curl": "curl -s 'https://miscsubjects.com/api/articles/oip-schools-physics/bundle'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article?",
        "What is the main concept explained in this article?",
        "What did Schrödinger prove in 1944, and what did Prigogine prove in 1977?",
        "What is the relationship between symmetry and conservation, and who proved it?",
        "What is self-organized criticality, and what is the canonical example?",
        "What is the Landauer bound, and what is its numerical value at room temperature?"
      ],
      "dependencies": [
        "oip",
        "oip-what-is-object",
        "oip-convergence-pattern-branching",
        "oip-convergence-pattern-bounded-chaos"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all physicists, their contributions, years, and the convergence points from the schema and article?",
        "english_clarity": "Can a zero-context reader explain the grain, negative entropy, dissipative structures, symmetry-breaking, and self-organized criticality without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for reading the article and the bundle?"
      }
    }
  },
  {
    "slug": "oip-schools-philosophy-west",
    "title": "Western Philosophers — The Grain as Immanent Order, Process, and the Reason Within Becoming",
    "machine_schema": {
      "definitions": {
        "grain": "The directional bias in the space of possible structures — a tilt toward certain structural solutions that recurs across all scales and domains without causal connection between instances.",
        "immanent_order": "Order that arises from within nature itself, not imposed from outside by a transcendent designer or personal deity; the laws and structures of the universe are the order.",
        "flux": "Continuous change, flow, or becoming; the condition of a system where every state is temporary and every structure is a pattern of movement rather than a fixed thing.",
        "conatus": "Spinoza's term for the striving of each thing to persist in its own being; the inherent tendency of every finite mode to maintain and enhance its existence.",
        "mode": "In Spinoza's metaphysics, a specific, finite modification or expression of the one infinite substance (God-or-Nature); every individual thing is a mode.",
        "substance": "In Spinoza's Ethics, that which exists in itself and is conceived through itself; there is only one substance, God-or-Nature, and everything else is a mode of it.",
        "prehension": "In Whitehead's process philosophy, the way an actual entity grasps or feels other actual entities into its own constitution; every event is a drop of experience that prehends its world.",
        "actual_entity": "Whitehead's term for the fundamental unit of reality — not a static object but a process of becoming, a moment of experience that prehends other moments and then perishes into objective immortality.",
        "objective_immortality": "In Whitehead's cosmology, the way a perished actual entity persists as a datum for future prehensions; the past is objectively immortal because it is felt by the present.",
        "process_philosophy": "The metaphysical view that reality is fundamentally process, event, and becoming rather than static substance, thing, or being; change is not an accident of things but their essential nature.",
        "logos": "Heraclitus's term for the underlying principle, law, or reason that governs the flux of all things; the pattern within the change, not separate from it.",
        "convergence": "The independent arrival at the same structural solution by different thinkers, in different centuries, using different vocabularies and starting from different problems.",
        "religious_naturalism": "The view that the natural world is worthy of reverence and that sacredness, awe, and objective value do not require a supernatural realm or a personal deity."
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-schools-philosophy-west",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-schools-philosophy-west/bundle",
        "read_json": "GET https://miscsubjects.com/api/articles/oip-schools-philosophy-west/bundle?format=json"
      },
      "examples": [
        {
          "description": "Read the article as HTML in a browser",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-schools-philosophy-west'"
        },
        {
          "description": "Read the article bundle as JSON with definitions and metadata",
          "curl": "curl -s 'https://miscsubjects.com/api/articles/oip-schools-philosophy-west/bundle?format=json'"
        },
        {
          "description": "Read the article bundle as raw markdown",
          "curl": "curl -s 'https://miscsubjects.com/api/articles/oip-schools-philosophy-west/bundle?format=markdown'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article?",
        "What is the main concept?",
        "Which three Western philosophers are the primary focus of this article?",
        "What is Spinoza's term for the striving of each thing to persist in its own being?",
        "What does Whitehead call the fundamental unit of reality?"
      ],
      "dependencies": [
        "oip",
        "oip-what-is-object",
        "oip-schools-physics",
        "oip-convergence-pattern-bounded-chaos"
      ],
      "scoring_rubric": {
        "json_clarity": "Schema must be valid JSON with no trailing commas, no comments, and all string values properly quoted.",
        "english_clarity": "Article must define every term inline, use no assumed knowledge, and explain every concept from zero context.",
        "operability": "Every route must be a real GET or POST that returns the described content; every curl example must be copy-paste runnable."
      }
    }
  },
  {
    "slug": "oip-schools-philosophy-east",
    "title": "Eastern Philosophers — The Grain as Non-Duality and the Dissolution of the Node-Whole Boundary",
    "machine_schema": {
      "definitions": {
        "Dao": "The way or path that cannot be named or fully described in language; the underlying grain or pattern that runs through all things without commanding or forcing them, first articulated in the Tao Te Ching around the 6th century BCE.",
        "wu wei": "Literally 'non-action' or 'effortless action'; the practice of acting along the grain of reality rather than against it, like water finding the lowest point, first described in the Tao Te Ching.",
        "dependent origination": "The Buddhist doctrine (pratītyasamutpāda) that no phenomenon exists independently; every thing arises from conditions, and those conditions arise from other conditions, such that the entire cosmos is a single web of mutual causation with no fixed boundaries between self and other.",
        "non-duality": "The claim that apparent opposites — self and world, subject and object, node and network — are not two separate things but one continuous structure viewed from different positions, articulated independently in Advaita Vedanta, Buddhism, and Taoism.",
        "Atman": "In Hindu philosophy, the individual self or soul; in Advaita Vedanta, it is identical with Brahman (the universal self), not metaphorically but structurally — the drop is the same water as the ocean.",
        "Brahman": "The universal consciousness or absolute reality in Vedantic philosophy; in Advaita Vedanta, it is identical with Atman, meaning the individual self and the cosmos are one continuous substance.",
        "butterfly dream": "The parable from Zhuangzi (c. 4th century BCE) in which the philosopher dreams he is a butterfly, then wakes uncertain whether he is a man who dreamed he was a butterfly or a butterfly dreaming he is a man; it demonstrates the interpenetration of self and cosmos with no fixed boundary.",
        "yin-yang": "The Taoist concept of complementary opposites that mutually define each other — light and dark, activity and receptivity, expansion and contraction — neither pole reducible to the other, both necessary for the whole, analogous to Bohr's complementarity in quantum physics."
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-schools-philosophy-east",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-schools-philosophy-east/bundle",
        "list_articles": "GET https://miscsubjects.com/api/articles",
        "selftest": "POST https://miscsubjects.com/api/selftest"
      },
      "examples": [
        {
          "description": "Read the article in HTML",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-schools-philosophy-east'"
        },
        {
          "description": "Read the full bundle (article + metadata + tests)",
          "curl": "curl -s 'https://miscsubjects.com/api/articles/oip-schools-philosophy-east/bundle'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article?",
        "What is the main concept of the Dao as described in the article?",
        "What does Zhuangzi's butterfly dream demonstrate about the boundary between self and cosmos?",
        "What is dependent origination and in which tradition does it originate?",
        "What is the Advaita Vedanta claim about Atman and Brahman?"
      ],
      "dependencies": [
        "oip",
        "oip-what-is-object",
        "oip-convergence-pattern-branching",
        "oip-convergence-pattern-bounded-chaos"
      ],
      "scoring_rubric": {
        "json_clarity": "The machine_schema must be valid JSON with no trailing commas, all strings quoted, and no unescaped newlines.",
        "english_clarity": "Every term must be defined inline on first use. No assumed knowledge. A reader with zero prior exposure must understand every concept.",
        "operability": "The article must be fetchable at /a/oip-schools-philosophy-east and its bundle at /api/articles/oip-schools-philosophy-east/bundle. All test_questions must be answerable from the article body alone."
      }
    }
  },
  {
    "slug": "oip-convergence-pattern-spirals",
    "title": "Spirals: The Growth-Rotation Solution",
    "machine_schema": {
      "definitions": {
        "spiral": "The locus of a point moving outward from a center at a rate proportional to its angular displacement; a curve that winds around a central point while continuously increasing its distance from that point.",
        "locus": "The complete set of all positions occupied by a moving point or object as it traces a path through space.",
        "angular_displacement": "The angle through which a point has rotated around a center, measured in degrees or radians, where one full rotation equals 360 degrees or 2π radians.",
        "radial_displacement": "The straight-line distance of a point from a central reference point, measured along a radius.",
        "logarithmic_spiral": "A spiral in which the angle between the tangent and the radius at any point is constant; described by r(θ) = r₀e^(bθ), where r is the radius at angle θ, r₀ is the initial radius, e is Euler's number (~2.71828), and b is a growth constant.",
        "divergence_angle": "The fixed angle between successive elements in a spiral pattern, measured at the center of the growing structure; the golden angle of 137.507764 degrees is the most efficient divergence angle for uniform packing.",
        "golden_angle": "The angle 137.507764 degrees, equal to 360° divided by φ_golden² or 2π/(1+φ_golden); the divergence angle that produces the most uniform packing of elements on a disk because it corresponds to the most irrational number.",
        "phyllotaxis": "The arrangement of leaves, seeds, or other plant organs on a stem or disk, governed by the equation θₙ = n×φ, rₙ = a√n where φ is the divergence angle and a is a scaling constant.",
        "Fibonacci_numbers": "The sequence where each number is the sum of the two preceding ones (1, 1, 2, 3, 5, 8, 13, 21, 34, 55...), which provide the best rational approximations to the golden ratio and appear as the numbers of visible spirals in sunflower heads and pinecones.",
        "density_wave": "A traveling compression wave in a galactic disk that triggers star formation and creates the visible spiral arms in spiral galaxies, first described by Chia-Chiao Lin and Frank Shu in 1964.",
        "Coriolis_force": "An apparent deflection of moving objects in a rotating reference frame, deflecting air to the right in the Northern Hemisphere and to the left in the Southern Hemisphere, named after Gaspard-Gustave de Coriolis (1835).",
        "conservation_of_angular_momentum": "The physical principle that a rotating object's angular momentum remains constant in the absence of external torque, causing rotational speed to increase as radius decreases."
      },
      "routes": {
        "GET /api/articles": "Returns the full list of published OIP articles with slugs, titles, and categories.",
        "GET /api/articles/{slug}": "Returns the complete article content including frontmatter, body text, and machine schema for a specific article identified by its slug.",
        "GET /api/directory": "Returns the complete directory of system capabilities, rows, and tool definitions available to the build.",
        "POST /api/directory/{key}": "Updates or creates a directory row with a given key, accepting JSON payload with content and metadata fields."
      },
      "examples": [
        {
          "name": "Sunflower seed packing",
          "description": "A mature sunflower head uses the golden angle divergence of 137.507764° to pack approximately 1,000–2,000 seeds into a disk 1–10 cm in diameter with ~81% area efficiency, exhibiting 34 clockwise and 55 counterclockwise spirals (consecutive Fibonacci numbers)."
        },
        {
          "name": "Nautilus shell growth",
          "description": "The chambered nautilus (Nautilus pompilius) builds its shell as a logarithmic spiral r(θ) = r₀e^(bθ) where each complete turn increases the radius by a factor of ~3.0–3.3, growing from ~10 cm to ~1 meter across the lifespan of the animal."
        }
      ],
      "test_questions": [
        "What is the mathematical formula for a logarithmic spiral, and what does each variable represent?",
        "Why is the golden angle (137.507764°) the most efficient divergence angle for packing elements on a disk, and what number-theoretic property of the golden ratio explains this?",
        "Describe the two physical conditions that must coexist for a spiral pattern to emerge, and give one example of a system that has one condition but not the other and therefore does not form a spiral."
      ],
      "dependencies": [
        "oip-convergence-pattern-tiling",
        "oip-convergence-pattern-branching",
        "oip-convergence-pattern-waves",
        "oip-mathematical-foundations-phi",
        "oip-scale-invariance-principle"
      ],
      "scoring_rubric": {
        "comprehension": {
          "excellent": "Can derive the spiral equation from first principles, explain the number-theoretic basis for the golden angle's efficiency, and identify the two necessary conditions for spiral emergence across at least three scale domains.",
          "good": "Can state the spiral definition, name the key equation (r(θ) = r₀e^(bθ) or phyllotaxis), explain the golden angle in terms of irrationality, and give two examples from different scales.",
          "adequate": "Can describe a spiral as outward growth with rotation, recognize the golden angle value, and identify one natural example with approximate scale.",
          "insufficient": "Cannot distinguish a spiral from a circle or helix, confuses the golden ratio with mystical significance, or cannot name a single natural example with correct scale."
        },
        "application": {
          "excellent": "Can predict whether a novel system will produce spiral patterns based on its growth and rotation characteristics, and can estimate packing efficiency given divergence angle.",
          "good": "Can identify growth and rotation components in a given system and determine if spiral formation is likely.",
          "adequate": "Can match known examples to the spiral pattern but cannot generalize to new systems.",
          "insufficient": "Cannot apply the spiral concept beyond the examples explicitly listed."
        }
      }
    }
  },
  {
    "slug": "oip-convergence-pattern-waves",
    "title": "Waves: The Transmission Solution",
    "machine_schema": {
      "definitions": {
        "wave": "A propagating disturbance that transfers energy and information through a medium or field without permanently displacing the material through which it travels.",
        "restoring_force": "A force that pushes a displaced part of a system back toward its equilibrium position, with magnitude proportional to the displacement.",
        "inertia": "The resistance of any object to changes in its state of motion.",
        "wave_equation": "The partial differential equation ∂²u/∂t² = c²∇²u that describes how a wave quantity u evolves in space and time.",
        "superposition": "The property that when two waves meet, the total displacement equals the sum of the individual displacements.",
        "interference": "The phenomenon where overlapping waves produce patterns of reinforcement and cancellation due to superposition.",
        "wavelength": "The spatial period of a wave, the distance over which the wave pattern repeats.",
        "frequency": "The number of complete oscillations per unit time, measured in hertz.",
        "de_broglie_wavelength": "The wavelength λ = h/p associated with a particle of momentum p, where h is Planck's constant.",
        "wave_function": "A complex-valued probability amplitude in quantum mechanics whose squared magnitude gives the probability density of finding a particle."
      },
      "routes": {
        "wave_equation_solver": "POST /api/wave/solve — accepts initial condition u(x,0) and boundary conditions, returns u(x,t) via finite-difference or spectral method.",
        "electromagnetic_spectrum": "GET /api/waves/spectrum — returns frequency/wavelength/speed data for all electromagnetic bands from gamma to radio.",
        "sound_speed_calculator": "POST /api/waves/sound-speed — accepts medium (air/water/steel), temperature, and pressure, returns wave speed c in m/s.",
        "gravitational_wave_catalog": "GET /api/waves/gw/events — returns LIGO/Virgo catalog of detected gravitational wave events with mass, distance, and strain."
      },
      "examples": [
        {
          "name": "Ocean Swell",
          "medium": " seawater",
          "wavelength": "100 m",
          "speed": "12.5 m/s",
          "restoring_force": "gravity",
          "equation": "c = √(gλ/2π)"
        },
        {
          "name": "Medical Ultrasound",
          "medium": "soft tissue",
          "frequency": "5 MHz",
          "wavelength": "3×10⁻⁴ m",
          "speed": "1540 m/s",
          "application": "fetal imaging"
        }
      ],
      "test_questions": [
        "What are the two conditions required for the wave equation to emerge in a physical system?",
        "Why can sound waves not travel through a vacuum, while electromagnetic waves can?",
        "How does the de Broglie wavelength of a particle change as its momentum increases?"
      ],
      "dependencies": [
        "oip-convergence-pattern-oscillators",
        "oip-convergence-pattern-fields",
        "oip-convergence-pattern-harmony"
      ],
      "scoring_rubric": {
        "conceptual_understanding": "Can explain wave propagation without permanent medium displacement (0-25)",
        "mathematical_literacy": "Can state the wave equation and interpret its terms (0-25)",
        "scale_awareness": "Can place at least three wave types on the 10⁻¹² to 10²¹ m scale (0-25)",
        "discrimination": "Can distinguish waves from diffusion, convection, ballistic transport, and simple oscillators (0-25)"
      }
    }
  },
  {
    "slug": "oip-convergence-pattern-symmetry",
    "title": "Symmetry: The Compression Solution",
    "machine_schema": {
      "definitions": {
        "symmetry": "Invariance under transformation; an object has symmetry if there exists a non-trivial operation (rotation, reflection, translation) that leaves it unchanged.",
        "non-trivial operation": "A transformation that actually changes the object in some way, as opposed to the identity operation that does nothing, yet still leaves the object looking the same.",
        "compression problem": "The fundamental question of how to specify a complex structure using the minimal possible amount of information.",
        "generating rule": "The underlying instruction or process that assembles a structure; when uniform across space, it produces symmetry.",
        "group_theory": "The mathematical framework that studies sets of elements with an operation satisfying closure, associativity, identity, and inverse properties.",
        "symmetry_group": "The set of all symmetry operations that leave an object unchanged, forming a group under the operation of composition.",
        "crystallographic_restriction": "The constraint that in three-dimensional space, only n-fold rotational symmetries where n equals 1, 2, 3, 4, or 6 are compatible with translational periodicity.",
        "space_group": "A complete description of all symmetry operations (translations, rotations, reflections, screw rotations, glide reflections) that leave a crystal invariant; exactly 230 exist.",
        "noethers_theorem": "A 1918 theorem by Emmy Noether stating that every continuous symmetry of the action of a physical system corresponds to a conserved quantity.",
        "action": "A mathematical quantity in physics that, when minimized or made stationary, yields the equations of motion of a system.",
        "continuous_symmetry": "A symmetry that can be varied smoothly, such as rotation by any angle, as opposed to discrete symmetries with fixed step sizes.",
        "gauge_symmetry": "A type of symmetry in which the Lagrangian of a physical system remains invariant under local transformations; the foundation of the Standard Model.",
        "SU3": "The special unitary group of degree 3, describing the strong nuclear force that binds quarks into protons and neutrons.",
        "SU2": "The special unitary group of degree 2, describing the weak nuclear force responsible for radioactive decay.",
        "U1": "The unitary group of degree 1, describing the electromagnetic force.",
        "CPT_symmetry": "The combined symmetry of charge conjugation, parity reflection, and time reversal; a fundamental property of physical laws.",
        "phylum": "A major taxonomic rank in biological classification, grouping organisms that share a common body plan."
      },
      "routes": {
        "GET /api/crystals/{space_group_id}": "Retrieve the full symmetry specification for a crystal belonging to one of the 230 space groups.",
        "POST /api/verify-symmetry": "Submit a set of transformation operations and receive a boolean indicating whether they form a valid group.",
        "GET /api/symmetry/{object_id}/operations": "List all symmetry operations (with their matrix representations) for a given symmetric object.",
        "POST /api/convergence/symmetry": "Query the symmetry convergence pattern across scale ranges, returning matching instances from 10^-18 m to 10^1 m.",
        "GET /api/noether/derivation": "Return the formal derivation of the conserved quantity corresponding to a specified continuous symmetry."
      },
      "examples": [
        {
          "title": "Snowflake Six-Fold Symmetry",
          "description": "A snowflake grown in supersaturated water vapor at -15°C exhibits six-fold rotational symmetry because the underlying hexagonal close-packed arrangement of water molecules in ice is dictated by the geometry of hydrogen bonding. The generating rule (crystallization) is uniform across space, and the environment (uniform temperature and pressure) presents no directional bias. Scale: 10^-3 to 10^-2 m."
        },
        {
          "title": "Viral Icosahedral Capsid",
          "description": "A viral capsid of 10^-7 m scale is built from 60 asymmetric protein subunits arranged in the lowest-energy configuration. The icosahedral symmetry (20 triangular faces, 12 vertices, 60 rotational operations) is not aesthetic choice but geometric necessity: it encloses the largest possible volume with the smallest number of protein subunits. The symmetry group SU(3) governs the strong force binding quarks; the capsid's symmetry is a physical, not biological, optimization."
        }
      ],
      "test_questions": [
        {
          "question": "Why does the crystallographic restriction prevent five-fold rotational symmetry in three-dimensional crystals?",
          "answer": "In three-dimensional space, only n-fold rotational symmetries where n equals 1, 2, 3, 4, or 6 are compatible with translational periodicity. A five-fold symmetry (72-degree rotation) cannot tile three-dimensional space without gaps, making it impossible to combine with infinite translation in a regular lattice."
        },
        {
          "question": "According to Noether's theorem, what conserved quantity corresponds to rotational symmetry?",
          "answer": "Noether's theorem (1918) states that every continuous symmetry of the action corresponds to a conserved quantity. Rotational symmetry corresponds to the conservation of angular momentum."
        },
        {
          "question": "What is the difference between local order and global symmetry, and why is a glass not symmetric?",
          "answer": "Local order is a statistical property where the arrangement of atoms around a given point is regular over short distances. Global symmetry is an exact geometric property where a non-trivial transformation leaves the entire object unchanged. A glass has local order but no global symmetry because no rotation, reflection, or translation leaves the entire structure unchanged."
        }
      ],
      "dependencies": [
        "oip-convergence-pattern-convergence",
        "oip-convergence-pattern-recursion",
        "oip-convergence-pattern-optimization"
      ],
      "scoring_rubric": {
        "understanding_symmetry_definition": "Can the student correctly define symmetry as invariance under transformation and identify non-trivial operations? (0-2 points)",
        "compression_connection": "Can the student explain how symmetry solves the compression problem by reducing the information needed to specify a structure? (0-2 points)",
        "group_theory_application": "Can the student identify the symmetry group of a simple object and explain closure under composition? (0-2 points)",
        "noether_connection": "Can the student name at least one conserved quantity and its corresponding continuous symmetry per Noether's theorem? (0-2 points)",
        "scale_convergence": "Can the student provide at least two concrete examples of symmetry from different scale ranges with correct measurements? (0-2 points)"
      }
    }
  },
  {
    "slug": "oip-convergence-pattern-flow-networks",
    "title": "Flow Networks: The Economy Solution",
    "machine_schema": {
      "definitions": {
        "flow_network": "A collection of nodes connected by conduits, optimized to move a quantity from sources to sinks with minimum total cost.",
        "node": "A junction in a flow network where flow gathers, splits, or changes direction.",
        "conduit": "A channel in a flow network that carries flow from one node to another.",
        "optimal_transport": "The mathematical theory of finding the cheapest way to move material from a source distribution to a sink distribution, formalized by Kantorovich in 1942.",
        "source_measure": "A mathematical object, denoted μ (mu), describing how much material is available at each point in space.",
        "sink_measure": "A mathematical object, denoted ν (nu), describing how much material is demanded at each destination point.",
        "transport_map": "A function T that specifies where each unit of source material is sent in the sink distribution.",
        "constructal_law": "The principle formulated by Adrian Bejan in 1996 stating that finite-size flow systems evolve to provide easier access to their currents.",
        "global_resistance": "The integral R = ∫(q²/kA)dl over a network, measuring total energy lost to friction and dissipation.",
        "packet_switched": "A network design where data is broken into packets that travel independently and are reassembled at the destination.",
        "small_world": "A network topology where most nodes are not neighbors but can be reached from any other node in a small number of steps.",
        "scale_free": "A network topology where the degree distribution follows a power law, meaning most nodes have few connections and a few hubs have many.",
        "distributary": "A channel in a river delta that splits away from the main channel and carries water and sediment toward the sea."
      },
      "routes": {
        "GET /api/flow/network": "Retrieve a flow network representation with nodes, conduits, and current flow values.",
        "POST /api/flow/optimize": "Submit a source and sink distribution to compute the optimal transport map and minimum cost.",
        "GET /api/flow/resistance": "Calculate the global resistance integral for a given network topology and conductivity profile.",
        "POST /api/flow/adapt": "Simulate dynamic adaptation of a flow network under changing source/sink conditions using reinforcement rules.",
        "GET /api/flow/scale": "Return the scale range and dimensional constants for a specified flow network type (river, circulatory, internet, etc.)."
      },
      "examples": [
        {
          "name": "Human circulatory system",
          "scale": "10⁻⁶ to 10⁰ meters",
          "flow_rate": "5 liters per minute at rest, up to 25 liters per minute during exercise",
          "total_path_length": "96,000 kilometers if all vessels laid end to end",
          "key_feature": "Closed-loop design returns blood to the heart, reusing pressure and minimizing energy"
        },
        {
          "name": "Slime mold network optimization",
          "scale": "10⁻⁴ to 10⁻² meters",
          "mechanism": "Veins carrying high flow thicken; veins carrying low flow atrophy and are pruned",
          "demonstration": "In 2010, Physarum polycephalum placed with oat flakes at Tokyo-area city locations reconstructed a network resembling the actual Tokyo rail system",
          "key_feature": "Dynamic adaptation without central planning through local reinforcement rules"
        }
      ],
      "test_questions": [
        "What is the mathematical difference between a branching system and a full flow network, and which constraint is relaxed to move from one to the other?",
        "State the Constructal Law in full, explain what each variable in the global resistance integral R = ∫(q²/kA)dl represents, and give one example of a natural system that minimizes this integral.",
        "Why do real flow networks include loops even though loops add construction cost, and how does this distinguish them from minimum spanning trees?"
      ],
      "dependencies": [
        "oip-convergence-pattern-branching",
        "oip-convergence-pattern-helical-flow",
        "oip-convergence-pattern-fractal-branching"
      ],
      "scoring_rubric": {
        "understanding_flow_vs_branching": "Can the student explain the three constraints that distinguish branching from flow networks (no loops, single source, no upstream merging)?",
        "quantitative_literacy": "Can the student cite at least two numerical values from the article (scales, flow rates, distances, error rates) with correct units?",
        "constructal_law_application": "Can the student apply the Constructal Law to a new example not covered in the article?",
        "distinguishing_misconceptions": "Can the student correctly identify why flow networks are not random graphs, not minimum spanning trees, and not centrally designed?",
        "cross_scale_reasoning": "Can the student explain why the same mathematical principle applies across 14 orders of magnitude?"
      }
    }
  },
  {
    "slug": "oip-convergence-pattern-memory",
    "title": "Memory: The Persistence Solution",
    "machine_schema": {
      "definitions": {
        "memory": "The capacity of a system to encode information about its past state into its present configuration, such that the encoded information can influence future behavior.",
        "persistence_problem": "The question of how order resists decay in a universe governed by the second law of thermodynamics, which states that entropy tends to increase.",
        "encoding": "The process of mapping one pattern onto another in a systematic way, such that knowing the mapping rule allows reconstruction or inference of the original pattern.",
        "stable_state": "A configuration of a physical substrate that persists for a time long compared to the processes that might disturb it.",
        "write_mechanism": "A physical process that alters the state of a substrate in a way that depends on some external condition, coupling the past state to the medium.",
        "read_mechanism": "A process in which the current state of a substrate influences the dynamics of a system in a state-dependent manner.",
        "refresh_mechanism": "A process that periodically rewrites stored information to counteract thermal degradation or other sources of error.",
        "landauer_limit": "The minimum energy required to erase one bit of information, equal to k_B T ln(2), approximately 2.9 × 10⁻²¹ joules at room temperature.",
        "shannon_capacity": "The maximum rate at which information can be transmitted through a channel, defined as the maximum mutual information I(X;Y) between input and output.",
        "error_correction_threshold": "The physical error rate p_th below which arbitrarily long computations are possible with polylogarithmic overhead through fault-tolerant encoding.",
        "clonal_expansion": "The rapid proliferation of a B or T cell that recognizes a specific antigen, producing a population of cells carrying the same receptor and thereby writing immune memory.",
        "long_term_potentiation": "A long-lasting strengthening of synaptic transmission between two neurons that have been repeatedly activated together, serving as the cellular basis of learning."
      },
      "routes": {
        "GET /api/inventory": "Returns a complete inventory of all files, R2 objects, KV entries, D1 rows, and pages the build can reach, including read/edit/delete capabilities for each.",
        "POST /api/dispatch": "The primary message dispatch endpoint; accepts an invoke parameter and a body, routes through the agent prompt system to directory rows, and returns the tool result.",
        "GET /api/directory/{key}": "Retrieves the content, target, and metadata of a single directory row by its exact key; used for reading agent prompts and tool configurations.",
        "PATCH /api/directory/{key}": "Updates a single directory row's content, target, or other fields; the primary mechanism for live prompt tuning without code changes.",
        "POST /api/cc_log": "Accepts Claude Code turn data (input + tool usage + files changed) and stores it in R2 for the build's self-observation and recursive review."
      },
      "examples": [
        {
          "name": "DNA Replication Memory",
          "substrate": "Double-stranded DNA molecule",
          "write": "DNA polymerase synthesizes a complementary strand with error rate ~10⁻⁹ per base pair",
          "read": "RNA polymerase transcribes the sequence into messenger RNA, which is translated into protein",
          "refresh": "DNA mismatch repair, base excision repair, and nucleotide excision repair correct ~10,000 lesions per cell per day",
          "scale": "3.2 × 10⁹ base pairs in human genome, ~1 bit per cubic nanometer, persists for organism lifetime and across generations"
        },
        {
          "name": "Immune Memory",
          "substrate": "B and T lymphocytes with specific antigen receptors",
          "write": "Clonal expansion increases specific cell population from hundreds to millions within one week of antigen exposure",
          "read": "Re-exposure to antigen triggers rapid antibody production and cytotoxic response by memory cells",
          "refresh": "Long-lived plasma cells and slowly dividing memory B/T cells maintain the population for decades",
          "scale": "Cell size ~10⁻⁶ m, lymphoid organs ~10⁻¹ m, persistence >50 years for smallpox vaccine memory"
        }
      ],
      "test_questions": [
        "Why is a granite boulder that has persisted for two billion years not considered to have memory?",
        "What are the four jointly necessary conditions that must be present for a system to possess genuine memory, and why is each one required?",
        "How does the Landauer limit connect the abstract concept of information to the physics of thermodynamics, and what is its numerical value at room temperature?"
      ],
      "dependencies": [
        "oip-convergence-pattern-entropy",
        "oip-convergence-pattern-information",
        "oip-convergence-pattern-encoding",
        "oip-convergence-pattern-error-correction"
      ],
      "scoring_rubric": {
        "full_credit": "Can explain all four conditions with examples, distinguish memory from persistence and information, quote the Landauer limit, and identify at least three convergence instances across different scales.",
        "partial_credit": "Can explain the definition and two conditions, but misses the distinction from persistence or cannot name convergence instances outside biology.",
        "no_credit": "Conflates memory with storage, persistence, or information; cannot name the four conditions; treats memory as a single thing rather than a convergent pattern."
      }
    }
  },
  {
    "slug": "oip-convergence-pattern-scale-invariance",
    "title": "Scale Invariance: The Recursion Solution",
    "machine_schema": {
      "definitions": {
        "scale_invariance": "The property that a structure or process looks statistically identical at different magnifications; formally f(λr) = λ^D f(r)",
        "self_similarity": "A structure that appears the same at different scales, either exactly or statistically",
        "scaling_exponent": "The power D in the scaling relation f(λr) = λ^D f(r), also called the fractal dimension",
        "fractal_dimension": "A non-integer dimension quantifying how a fractal fills space, typically the Hausdorff dimension",
        "Hausdorff_dimension": "A rigorous measure of fractal dimension defined as D_H = lim_{ε→0} log N(ε) / log(1/ε), where N(ε) is the number of boxes of size ε needed to cover the object",
        "power_law": "A mathematical relationship where one quantity is proportional to another raised to a constant exponent, with no characteristic scale",
        "power_spectrum": "The distribution of a signal's power across different frequencies, denoted P(k)",
        "correlation_length": "The average distance ξ over which fluctuations in one part of a system influence another part",
        "renormalization_group": "A theoretical framework explaining how physical systems behave under scale transformations, developed by Wilson, Fisher, and Kadanoff in the 1970s",
        "critical_point": "A state where two phases of a system become indistinguishable and the correlation length diverges to infinity",
        "nonlinear_recursion": "A recursive rule where the output interacts with the input multiplicatively rather than additively",
        "Kolmogorov_5_3_law": "The power law E(k) ~ k^(-5/3) describing the energy spectrum of fully developed turbulence, published by Andrey Kolmogorov in 1941",
        "Harrison_Zeldovich_spectrum": "The prediction P(k) ~ k^(-3) for the scale-invariant power spectrum of cosmic density fluctuations, proposed by Edward Harrison and Yakov Zel'dovich in 1970",
        "iterated_function_system": "A mathematical formalism using probabilistic affine transformations to generate self-similar fractal structures, developed by Michael Barnsley in 1988",
        "Richardsons_paradox": "The observation that the measured length of a coastline increases without bound as the measurement scale decreases, documented by Lewis Fry Richardson in 1961"
      },
      "routes": {
        "GET /api/articles/scale-invariance": "Retrieve the full article content including inline definitions and machine schema",
        "POST /api/dispatch?invoke=SCALE_ANALYSIS": "Submit a natural language query about scale-invariant properties of a given system; returns power-law fit parameters and Hausdorff dimension estimate",
        "GET /api/directory/scale-invariant-systems": "List all directory rows tagged as scale-invariant with their measured exponents and scale ranges",
        "POST /api/dispatch?invoke=FRACTAL_DIMENSION": "Compute the Hausdorff dimension of a provided dataset or image using the box-counting method"
      },
      "examples": [
        {
          "description": "Measuring the fractal dimension of a coastline",
          "steps": "Place a grid of boxes of size ε over a map of Britain. Count N(ε), the number of boxes that touch the coastline. Repeat for ε = 10^3 m, 10^4 m, 10^5 m, 10^6 m. Plot log N(ε) versus log(1/ε). The slope of the best-fit line is D_H ≈ 1.25."
        },
        {
          "description": "Verifying the Kolmogorov 5/3 law in a wind tunnel",
          "steps": "Measure the velocity fluctuations in a turbulent jet at Reynolds number 10^5. Compute the energy spectrum E(k) via Fourier transform. Plot log E(k) versus log k over the inertial range (10^2 to 10^4 m^-1). The slope should be -5/3 ≈ -1.67 within experimental error of ±0.05."
        }
      ],
      "test_questions": [
        "What is the formal mathematical definition of scale invariance, and what does the scaling exponent D represent?",
        "Explain why scale invariance emerges at critical points according to the renormalization group theory. What happens to the correlation length ξ?",
        "Describe the difference between strict geometric self-similarity and statistical self-similarity, and give one real-world example of each."
      ],
      "dependencies": [
        "oip-convergence-pattern-criticality",
        "oip-convergence-pattern-emergence",
        "oip-convergence-pattern-recursion",
        "oip-convergence-pattern-entropy"
      ],
      "scoring_rubric": {
        "conceptual_understanding": {
          "weight": 0.3,
          "criteria": "Can articulate the formal definition f(λr) = λ^D f(r), explain what D measures, and distinguish scale invariance from periodicity or translation invariance"
        },
        "mathematical_literacy": {
          "weight": 0.25,
          "criteria": "Can compute Hausdorff dimension from box-counting data, interpret power spectrum P(k) ~ k^(-β), and relate β to D"
        },
        "physical_examples": {
          "weight": 0.25,
          "criteria": "Can name at least four convergence instances with correct scale ranges, exponents, and named discoverers or theories"
        },
        "boundary_conditions": {
          "weight": 0.2,
          "criteria": "Can articulate why scale invariance requires no intrinsic length scale, can identify cutoffs in real systems, and can explain why not all power laws are fractal"
        }
      }
    }
  },
  {
    "slug": "oip-schools-information",
    "title": "\"The Information Theorists: How Compression Reveals the Grain\"",
    "machine_schema": {
      "definitions": {
        "information": "The reduction of uncertainty, measured in bits, formalized by Claude Shannon in 1948 as H = -Σ p_i log p_i, where p_i is the probability of state i.",
        "entropy": "A measure of disorder or uncertainty, defined in statistical mechanics by Boltzmann and Gibbs in the 1870s-1900s as S = k log W, and in information theory by Shannon as H = -Σ p_i log p_i. Information and entropy are the same quantity measured in different units.",
        "bit": "A binary digit, the fundamental unit of information representing a choice between two equally likely alternatives.",
        "Shannon_entropy": "The formula H = -Σ p_i log p_i, published by Claude Shannon in 1948, measuring the information content of a probability distribution.",
        "Landauer_bound": "The minimum thermodynamic energy required to erase one bit of information, equal to k_B T ln(2), where k_B is Boltzmann's constant (~1.38 × 10^-23 J/K) and T is temperature in kelvin. At room temperature (300 K), this is approximately 2.9 × 10^-21 joules per bit.",
        "Boltzmann_constant": "The physical constant k_B ≈ 1.38 × 10^-23 joules per kelvin, relating temperature to energy at the molecular scale.",
        "Kolmogorov_complexity": "The length of the shortest program that generates a given string on a universal computer, defined by Andrey Kolmogorov in 1965. It measures the algorithmic compressibility of a structure.",
        "compressibility": "The ratio between the information content of a system's complete state and the information content of the rules that generate it. A highly compressible universe is one where short laws generate vast complexity.",
        "algorithmic_information_theory": "The field founded by Kolmogorov, Solomonoff, and Chaitin that defines information as the length of the shortest description, linking structure to compressibility.",
        "generativity": "The capacity of a short description or rule to produce vast and complex output. The universe exhibits generativity because its laws are short but its consequences are enormous.",
        "logical_depth": "The computational cost of generating a string from its shortest description, introduced by Charles Bennett in 1982. A structure with high logical depth is easy to describe but expensive to generate.",
        "Jaynesian_maximum_entropy": "The principle, introduced by Edwin Jaynes in 1957, that statistical mechanics is a form of information-theoretic inference, where the entropy of a physical system is the Shannon entropy of a probability distribution."
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-schools-information",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-schools-information/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-schools-information/bundle?format=markdown",
        "list_articles": "GET https://miscsubjects.com/api/articles"
      },
      "examples": [
        {
          "description": "Read the Information Theorists article as HTML",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-schools-information'"
        },
        {
          "description": "Read the full machine bundle (article + schema + metadata) as JSON",
          "curl": "curl -s 'https://miscsubjects.com/api/articles/oip-schools-information/bundle'"
        }
      ],
      "test_questions": [
        "What is the exact URL to read this article?",
        "What is Shannon's definition of information and what is the formula for Shannon entropy?",
        "What is the Landauer bound and what is its numerical value at room temperature?",
        "What did Kolmogorov define in 1965 and how does it relate to compressibility?",
        "What is the unified result of the four-field convergence described in the article?"
      ],
      "dependencies": [
        "oip",
        "oip-what-is-object",
        "oip-convergence-pattern-branching",
        "oip-convergence-pattern-bounded-chaos",
        "oip-schools-physics"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all definitions, routes, and dependencies from the schema?",
        "english_clarity": "Can a zero-context reader explain information, entropy, the Landauer bound, Kolmogorov complexity, and compressibility without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for reading the article and its bundle?"
      }
    }
  },
  {
    "slug": "oip-schools-biology",
    "title": "'The Biologists: Design Without a Designer'",
    "machine_schema": {
      "definitions": {
        "natural_selection": "The process by which organisms vary in their traits, some variations are retained better than others because they improve survival or reproduction, and those retained variations are inherited by offspring. The three required ingredients are variation, differential retention, and heredity.",
        "variation": "The property that individuals in a population are not identical. In any population of organisms, there are differences in traits such as size, color, resistance, or behavior. This variation is the raw material on which selection operates.",
        "differential_retention": "The property that not all variants survive and reproduce at the same rate. Some variants are better retained by the environment because they confer advantages in survival, reproduction, or persistence. Differential retention is the filter in the selection algorithm.",
        "heredity": "The property that traits are passed from parents to offspring with some degree of fidelity. Without heredity, the output of selection cannot be preserved across generations, and the algorithm cannot accumulate design.",
        "modern_synthesis": "The merger of Mendelian genetics with Darwinian natural selection, accomplished between 1924 and 1942 by researchers including Ronald Fisher, J. B. S. Haldane, Sewall Wright, Theodosius Dobzhansky, and Ernst Mayr. It established that evolution is the change in allele frequencies in populations.",
        "evo_devo": "Short for evolutionary developmental biology. The field that studies how developmental processes evolve, showing that the same toolkit of regulatory genes controls body plans across phyla and that changes in developmental timing can produce major evolutionary transitions without new genes.",
        "autopoiesis": "From the Greek auto (self) and poiesis (production). The property of a living system to continuously produce the components that constitute it, through a network of processes where each component participates in producing at least one other component. A cell is an autopoietic system because it builds its own walls.",
        "self_production": "The characteristic of a system that produces its own components. In an autopoietic system, the membrane enzymes produce membrane lipids, ribosomes produce enzymes, and DNA encodes ribosomes, forming a closed production cycle.",
        "closed_production_cycle": "A network of component-producing processes in which each component participates in producing at least one other component, and the entire network is operationally closed. No component is produced entirely outside the system, though matter and energy are exchanged with the environment.",
        "replicator": "In Dawkins's selfish gene framework, an entity that passes on its structure largely intact during reproduction. A gene is the canonical replicator. Replicators are selected for their ability to make copies of themselves.",
        "vehicle": "In Dawkins's selfish gene framework, the temporary survival machine built by replicators to carry themselves into the next generation. An organism is a vehicle. Vehicles are selected for their ability to protect and propagate the replicators inside them.",
        "price_equation": "A mathematical identity derived by George Price in 1970 that decomposes evolutionary change into a selection component and a transmission component. The equation is Δz = Cov(w, z) / w̄ + E(w Δz) / w̄, and it applies to any system with heritable variation and differential reproduction.",
        "evolutionary_epistemology": "The theory, developed by Donald Campbell in 1974, that the growth of knowledge follows a variation-and-selection process. Scientific theories are generated by blind variation and selected by elimination through criticism and experiment.",
        "neural_darwinism": "Gerald Edelman's 1987 theory that the brain is a selective system, not an instructional system. The brain develops through Neuronal Group Selection, where experience strengthens some neuronal connections and weakens others, with synaptic pruning as the selective mechanism.",
        "neuronal_group_selection": "The mechanism proposed by Edelman in which the brain starts with an overproduction of neurons and synapses, and experience selects which groups survive and which are pruned. Groups that fire together wire together through reentrant mapping.",
        "reentrant_mapping": "The process by which parallel signals between different brain maps correlate sensory inputs with motor outputs, selecting which neuronal groups fire together. Reentrant mapping is the mechanism by which the brain's secondary repertoire is shaped by experience.",
        "assembly_theory": "A framework developed in the 2010s by Lee Cronin and colleagues at the University of Glasgow that measures molecular complexity by the number of steps required to assemble a molecule. Life is characterized by a high assembly index, indicating complex selection history."
      },
      "routes": {
        "read_article": "GET https://miscsubjects.com/a/oip-schools-biology",
        "read_bundle": "GET https://miscsubjects.com/api/articles/oip-schools-biology/bundle",
        "read_bundle_markdown": "GET https://miscsubjects.com/api/articles/oip-schools-biology/bundle?format=markdown",
        "search_related": "GET https://miscsubjects.com/api/search?q=natural+selection"
      },
      "examples": [
        {
          "description": "Read the Biologists article as HTML",
          "curl": "curl -s 'https://miscsubjects.com/a/oip-schools-biology'"
        },
        {
          "description": "Read the full machine bundle (article + schema + metadata) as JSON",
          "curl": "curl -s 'https://miscsubjects.com/api/articles/oip-schools-biology/bundle'"
        }
      ],
      "test_questions": [
        "What are the three ingredients required for natural selection, and what does each one mean?",
        "What did Darwin and Wallace prove independently in 1858, and where was their paper presented?",
        "What is autopoiesis, who introduced it, and what is the closed production cycle of a cell?",
        "What is the Price equation, who derived it, and in what year?",
        "What is neural Darwinism, who proposed it, and how does reentrant mapping work?",
        "What is the difference between a replicator and a vehicle in Dawkins's framework?",
        "What is evolutionary epistemology, and how does it apply to scientific knowledge?"
      ],
      "dependencies": [
        "oip",
        "oip-what-is-object",
        "oip-schools-physics"
      ],
      "scoring_rubric": {
        "json_clarity": "Can the model identify all biologists, their contributions, years, and the convergence points from the schema and article?",
        "english_clarity": "Can a zero-context reader explain natural selection, autopoiesis, the selfish gene, neural Darwinism, and evolutionary epistemology without guessing?",
        "operability": "Can the model open the exact URL in a browser or web-fetch tool (never curl or a code sandbox) for reading the article and the bundle?"
      }
    }
  },
  {
    "slug": "oip-schools-cybernetics",
    "title": "\"The Cyberneticians: Feedback, Variety, and the Edge of Chaos\"",
    "machine_schema": {
      "definitions": {
        "feedback": "A process in which a system senses its own output and uses that information to modify its future behavior; can be negative (stabilizing) or positive (amplifying).",
        "cybernetics": "The study of systems that regulate themselves through feedback and communication, whether in animals, machines, or organizations; coined by Norbert Wiener in 1948.",
        "requisite variety": "A principle formulated by W. Ross Ashby stating that a system must possess at least as many internal states as the environment has disturbances it must control; only variety can destroy variety.",
        "autopoiesis": "The property of a living system to continuously produce the components that sustain its own network; self-creation as a defining characteristic of life.",
        "self-organized_criticality": "The tendency of certain systems to spontaneously evolve to a critical state on the border between order and chaos, producing power-law-distributed events without external tuning.",
        "edge_of_chaos": "The critical boundary between ordered, frozen behavior and chaotic, random behavior, where complex systems exhibit maximal information processing and adaptation.",
        "power_law": "A mathematical relationship where the probability of an event of size x is proportional to x raised to a constant negative exponent; produces scale-invariant distributions with no characteristic scale.",
        "scale_free_network": "A network whose degree distribution follows a power law, characterized by a few highly connected hubs and many sparsely connected nodes, with no typical scale.",
        "small_world_network": "A network that exhibits both high local clustering and short global path lengths, achieved by adding a small fraction of random long-range connections to a regular lattice.",
        "neuronal_avalanche": "Cascades of neural activity observed in cortex with sizes following a power-law distribution, first measured by Beggs and Plenz in 2003, indicating self-organized criticality in the brain."
      },
      "routes": {
        "POST /api/dispatch": "Invoke a cybernetic system action; body must contain an exact tool tag and the complete argument payload, dispatched via the directory row's target URL.",
        "GET /api/directory/{key}": "Retrieve the full row definition, contract, target URL, and prompts for a named cybernetic tool or system.",
        "POST /api/directory/{key}": "Update the contract or prompt for a directory row; pushes changes to the live system without redeploy.",
        "GET /api/inventory": "Return a complete list of every file, R2 object, KV entry, and D1 row reachable by the system, with read, edit, and delete flags."
      },
      "examples": [
        "A thermostat maintaining room temperature at 20 degrees Celsius uses negative feedback: it senses deviation, activates heating, and returns to the set point. If the thermostat had only two states (on/off) and the environment included drafts, humidity, and sunlight, its internal variety would be insufficient to control the environment — an illustration of Ashby's Law of Requisite Variety.",
        "Beggs and Plenz recorded electrical activity from rat cortical slices on 60-electrode arrays spaced 200 micrometers apart, observing neuronal avalanches with a size distribution following a power law with exponent -1.5. This matched the critical branching process predicted by self-organized criticality, indicating the brain operates at the edge of chaos to maximize information transmission per spike."
      ],
      "test_questions": [
        "What is the difference between negative and positive feedback, and which did Wiener's anti-aircraft gun-control system rely on?",
        "State Ashby's Law of Requisite Variety in your own words and give a historical example of a system that failed because it violated this law.",
        "What quantitative evidence supports the claim that the brain operates at the edge of chaos?"
      ],
      "dependencies": [
        "oip-schools-thermodynamics",
        "oip-schools-mechanics",
        "oip-schools-information",
        "oip-schools-complexity"
      ],
      "scoring_rubric": {
        "depth_of_coverage": {
          "weight": 0.25,
          "criteria": "Demonstrates understanding of feedback, requisite variety, autopoiesis, self-organized criticality, and the edge of chaos as an interconnected framework."
        },
        "quantitative_accuracy": {
          "weight": 0.25,
          "criteria": "Correctly cites specific measurements (avalanche exponent -1.5, K=2, p=0.01, power-law exponents) and distinguishes them from approximate claims."
        },
        "conceptual_clarity": {
          "weight": 0.25,
          "criteria": "Explains every term from first principles, defining it inline for a reader with no assumed knowledge of cybernetics or systems theory."
        },
        "what_it_is_not": {
          "weight": 0.15,
          "criteria": "Correctly identifies at least three misconceptions the cybernetic grain does NOT represent (fixed laws, blueprint, single universal law)."
        },
        "machine_schema_completeness": {
          "weight": 0.1,
          "criteria": "All required fields present: definitions, routes, examples, test_questions, dependencies, scoring_rubric."
        }
      }
    }
  },
  {
    "slug": "oip-the-ladder",
    "title": "\"The Ladder: From Difference to Mind\"",
    "machine_schema": {
      "definitions": {
        "gradient": "A spatial variation in a measurable quantity such that the value changes from one location to another; the driver of all physical flow.",
        "flux": "The rate of flow of a quantity per unit area per unit time, expressed generically as negative conductivity multiplied by the gradient.",
        "conductivity": "A material-specific coefficient that quantifies how readily a substance permits the flow of heat, particles, charge, or fluid under a gradient.",
        "entropy": "A measure of the number of equivalent microscopic configurations consistent with a system's macroscopic state, or equivalently the degree to which a gradient has been flattened.",
        "dissipation": "The process by which a gradient is converted into unstructured thermal motion, increasing the total entropy of the system.",
        "structure": "A spatial configuration of matter that persists because flow through it erases the driving gradient more efficiently than unstructured flow would.",
        "memory": "A physical structure that encodes information about past states in a form that can be read by current flow and maintained through a store-degrade-detect-repair loop.",
        "self_replicating": "A system capable of producing copies of itself using information stored within itself, subject to an error threshold that must not be exceeded.",
        "critical_seam": "The boundary between error and accuracy where the mutation rate is high enough to generate variation but low enough to preserve memory; the operating point of life.",
        "phi": "Integrated information, denoted Φ, the minimum over all partitions of the mutual information between a system and its own past state; a measure of the unity and differentiation of a conscious system.",
        "teleological": "Relating to an explanation by reference to a purpose or end goal; the ladder is explicitly not teleological.",
        "thermodynamic": "Relating to the statistical mechanics of energy, entropy, and equilibrium; the direction of the ladder is thermodynamic, not purposeful."
      },
      "routes": {
        "GET /api/patterns": "List all eight patterns including difference, flow, structure, memory, life, mind, and their extensions.",
        "GET /api/patterns/:slug": "Retrieve the full article, definitions, and machine schema for a single pattern by its slug.",
        "POST /api/dispatch": "Invoke a pattern by sending a natural-language message; the router resolves the intent to the appropriate tool or pattern.",
        "GET /api/ledger": "Retrieve the event log of all pattern invocations, gradient detections, and system responses for audit and verification."
      },
      "examples": [
        {
          "title": "Riverbed as Structure",
          "description": "Water flowing downhill erodes soil and rock, creating channels. The channels are structure because they concentrate flow and accelerate the dissipation of the elevation gradient more efficiently than uniform sheet flow would. A riverbed persists for millennia because it is the most efficient path for the water to take."
        },
        {
          "title": "Human Brain as Mind",
          "description": "The brain weighs 1.4 kg (2% of body mass), consumes 20 W (20% of resting energy), contains 86 billion neurons and 10^14 synapses. It models the environment and itself, enabling prediction and control. Under Integrated Information Theory, its phi is high because its states are both highly differentiated and irreducible to independent parts."
        }
      ],
      "test_questions": [
        "Why does the ladder have a thermodynamic direction rather than a teleological goal? Explain in terms of gradient dissipation and entropy production.",
        "Calculate the Landauer cost of erasing one bit at 300 K and explain why this cost implies that information is physical.",
        "What is the error threshold in Eigen's quasi-species model, and why does life operate just below it rather than safely above or far below?"
      ],
      "dependencies": [
        "oip-difference",
        "oip-flow",
        "oip-structure",
        "oip-memory",
        "oip-life",
        "oip-mind"
      ],
      "scoring_rubric": {
        "comprehension": {
          "excellent": "Can explain each rung with its physical laws, quantities, and the transition to the next rung without reference to purpose or design.",
          "good": "Can identify the six rungs and state the general direction of the ladder, with minor errors in physical laws or quantities.",
          "fair": "Can name the rungs but confuses the mechanisms or introduces teleological language.",
          "poor": "Cannot distinguish the rungs or treats the ladder as a hierarchy of moral value."
        },
        "application": {
          "excellent": "Can identify a novel system and map it to the correct rung or rungs using gradient, flow, and dissipation concepts.",
          "good": "Can map familiar examples to the correct rung with correct reasoning.",
          "fair": "Can map examples but with incorrect reasoning or mixed rungs.",
          "poor": "Cannot map any example to the ladder."
        },
        "precision": {
          "excellent": "Uses exact quantities, named laws, and correct units throughout; cites Landauer, Prigogine, Eigen, and Tononi accurately.",
          "good": "Uses most quantities and laws correctly with occasional missing units or names.",
          "fair": "Uses some quantities but mixes laws or states them imprecisely.",
          "poor": "Makes no use of quantitative or named-source information."
        }
      }
    }
  },
  {
    "slug": "oip-schools-ai-ml",
    "title": "The AI and Machine Learning Researchers: The Optimal Architecture for Learning",
    "machine_schema": {
      "definitions": {
        "gradient_descent": "An optimization algorithm that minimizes a function by iteratively moving in the direction of the steepest decrease, analogous to a hiker descending a mountain in fog by feeling the local slope.",
        "loss_landscape": "A mathematical surface where each point represents a possible configuration of a neural network's parameters and the height represents the error or loss for that configuration.",
        "dissipative_structure": "A physical concept from non-equilibrium thermodynamics describing ordered patterns that emerge and persist in systems that continuously export entropy into their environment.",
        "attention_mechanism": "A neural network component that computes a weighted average of values based on similarity scores between queries and keys, allowing the model to focus on relevant parts of an input sequence.",
        "token": "A unit of text processed by a language model, typically a word fragment averaging about 0.75 words in English, which serves as the atomic element of the model's input and output.",
        "transformer": "A neural network architecture composed of self-similar layers, each containing self-attention, feedforward processing, and normalization, designed to process sequences in parallel rather than sequentially.",
        "self_attention": "An attention mechanism where every element of a sequence attends to every other element in the same sequence, producing contextualized representations through parallel similarity scoring.",
        "scaling_law": "A predictable power-law relationship, such as L(N) = (N_c/N)^0.07, describing how a model's loss decreases as its parameter count, data, or compute increases.",
        "phase_transition": "An abrupt change in the properties of a system when a control parameter crosses a critical threshold, analogous to water freezing at zero degrees Celsius.",
        "criticality": "The condition where a system operates at the boundary between order and chaos, maximizing information propagation and computational expressiveness.",
        "self_organized_criticality": "A property of systems that naturally tune themselves to a critical point without external intervention, producing power-law distributed fluctuations known as avalanches.",
        "temperature_parameter": "An inference hyperparameter T that controls the randomness of token selection in language models, with T=0 producing deterministic output and T near 1.0 producing the most varied and useful text.",
        "command_plane": "The layer of control mechanisms, including prompt engineering, chain-of-thought reasoning, and tool use, that manages inference to keep a language model operating near the critical seam."
      },
      "routes": {
        "GET /api/articles": "Returns a paginated list of all OIP articles with their slug, title, category, and excerpt.",
        "GET /api/articles/:slug": "Returns the full content of a single article identified by its slug, including frontmatter, body text, and machine schema.",
        "GET /api/definitions": "Returns all term definitions from the OIP corpus, filterable by article slug or category via query parameters.",
        "GET /api/search?q=term": "Performs full-text search across all article bodies and definitions, returning matching paragraphs with relevance scores."
      },
      "examples": [
        {
          "title": "GPT-3 Few-Shot Translation",
          "description": "Brown et al. (2020) demonstrated that GPT-3 could translate between English and French using only a few examples in the prompt, but this capability emerged only in the 175-billion-parameter model, not in smaller variants. The transition was sharp, not gradual, indicating a phase transition in the model's representational capacity."
        },
        {
          "title": "Critical Initialization in Deep Networks",
          "description": "Poole et al. (2016) proved that when a deep neural network is initialized with weights at a critical value, information can propagate across arbitrarily many layers without decaying or exploding. This critical initialization corresponds to the boundary between order and chaos in the network's dynamics."
        },
        {
          "title": "Temperature Tuning in Chat Interfaces",
          "description": "When a user interacts with a large language model through a chat interface, the temperature slider controls the system's position relative to the critical seam. At T=0.7, the model produces the most highly-rated output across diverse tasks, demonstrating that human preference aligns with the critical regime."
        }
      ],
      "test_questions": [
        "What is gradient descent and why is it described as a dissipative structure rather than a purely mathematical algorithm?",
        "How does the attention mechanism implement wave-like routing, and why is this routing significant for information processing?",
        "What are the scaling laws discovered by Kaplan et al. (2020), and what does the power-law form imply about the relationship between model size and performance?",
        "Explain emergent capabilities as phase transitions, using in-context learning or chain-of-thought reasoning as a concrete example with parameter thresholds."
      ],
      "dependencies": [
        "oip-foundations",
        "oip-machine-pattern",
        "oip-criticality",
        "oip-dissipative-structures",
        "oip-scale-invariance",
        "oip-self-organization",
        "oip-information-theory",
        "oip-neural-criticality"
      ],
      "scoring_rubric": {
        "comprehension": {
          "excellent": "The respondent can define gradient descent, attention mechanisms, transformers, scaling laws, phase transitions, and criticality in their own words, and correctly identifies at least six of the eight grain patterns instantiated in machine learning.",
          "good": "The respondent defines at least four of the six core concepts accurately and identifies at least four grain patterns with correct examples.",
          "adequate": "The respondent defines at least two core concepts and identifies at least two grain patterns, though some definitions may be imprecise or incomplete.",
          "insufficient": "The respondent cannot define more than one core concept or conflates key terms such as gradient descent with attention mechanisms."
        },
        "application": {
          "excellent": "The respondent can explain how a specific engineering choice, such as adding residual connections or adjusting the temperature parameter, moves a neural network closer to or farther from the critical seam, and can predict the consequences of that choice on training dynamics or inference quality.",
          "good": "The respondent can explain at least one engineering choice in terms of the critical seam and connect it to observable behavior, such as why T=0.7 produces better output than T=0.",
          "adequate": "The respondent can identify an engineering choice but describes its effect in purely technical terms without connecting it to the critical seam or grain pattern.",
          "insufficient": "The respondent cannot connect any engineering choice to the critical seam or describes the choices as arbitrary or aesthetic rather than structurally determined."
        }
      }
    }
  },
  {
    "slug": "oip-schools-complexity-science",
    "title": "The Complexity Scientists: The Edge of Chaos",
    "machine_schema": {
      "machine_schema": {
        "definitions": {
          "complex_adaptive_system": "A system composed of many interacting agents that adapt to each other and to their environment, producing emergent behaviors at the system level that no single agent could produce alone. Coined by John Holland in 1995.",
          "emergence": "The phenomenon where the whole of a system becomes greater than the sum of its parts in ways that are not deducible from the properties of the parts alone. Popularized by Philip Anderson in 1972.",
          "self_organization": "The process by which complex structures arise spontaneously from the interactions of simpler components without any external blueprint or central controller. Studied by Stuart Kauffman in Boolean networks.",
          "edge_of_chaos": "The boundary between ordered and chaotic dynamical regimes, identified by Kauffman and Langton, where computation and adaptability are maximized. Also called the critical seam.",
          "self_organized_criticality": "The property of a slowly driven, interaction-dominated system to naturally evolve to a critical state without external tuning, discovered by Bak, Tang, and Wiesenfeld in 1987.",
          "power_law": "A mathematical relationship where the frequency of an event is proportional to a power of its size, producing scale-free distributions with no characteristic scale. Examples include the Gutenberg-Richter law with exponent b approximately 1.0.",
          "lyapunov_spectrum": "A set of numbers that measure the rates at which nearby trajectories in a dynamical system's phase space diverge or converge exponentially over time. Positive values indicate chaos; negative values indicate order.",
          "criticality_function": "A mathematical expression C(R) = I_max(R) * chi(R) * C_info(R) / [H(R) + epsilon] that quantifies how well a system is positioned at the edge of chaos, peaking at the critical point R_c."
        },
        "routes": {
          "GET /api/inventory": "Enumerates every file/object the build can reach including repo files, R2 objects, KV entries, and D1 directory rows, each with read/edit/delete capabilities. Returns a live inventory from GitHub + R2.",
          "GET/PUT/DELETE /api/file": "Reads, writes, or deletes a file in the repository directly to the main branch. PUT commits the file; DELETE removes it. The build can edit its own files through this route.",
          "POST /api/dispatch": "The core message dispatch endpoint. Accepts a message body and routes it through the agent system, invoking the appropriate tool tags and returning the tool output. Used for real-time testing of the build.",
          "POST /api/cc_log": "Receives Claude Code turn logs from the hook at .claude/hooks/cc-turn-log.js. Stores each turn (input + tools used + files changed) for the build to read and act upon."
        },
        "examples": [
          {
            "name": "Sandpile Self-Organization",
            "description": "A sandpile built grain by grain on a table self-tunes to a critical slope of approximately 35 degrees. Avalanches then follow a power law: for each tenfold increase in avalanche size, frequency drops by a factor of 10. No external tuning is required; the separation of slow driving (grain addition) and fast dissipation (avalanches) produces criticality automatically."
          },
          {
            "name": "Neuronal Avalanches in Rat Cortex",
            "description": "In experiments by Beggs and Plenz (2003), slices of rat cortex exhibited cascades of neural activity with a power law distribution of sizes, exponent approximately negative 1.5. The brain self-organizes to criticality, giving it the largest dynamic range of responses—from single-photon detection to loud thunder—using the same neural hardware."
          }
        ],
        "test_questions": [
          "What is the difference between a complex adaptive system and a merely complicated system? Define both terms and give a concrete example of each from the text, with dates and names.",
          "Explain the mechanism of self-organized criticality using the sandpile model. What are the two separated timescales, and what power law governs the resulting avalanche distribution?",
          "The criticality function C(R) is defined as a ratio of three numerator quantities to one denominator quantity. Name all four quantities and explain what each one measures, including the physical significance of the epsilon term."
        ],
        "dependencies": [
          "oip-peptide-vasculature",
          "oip-peptide-phyllotaxis",
          "oip-peptide-neural-signaling",
          "oip-peptide-bilateral-symmetry",
          "oip-peptide-metabolic-networks",
          "oip-peptide-dna-immune-memory",
          "oip-peptide-allometric-scaling"
        ],
        "scoring_rubric": {
          "comprehension": {
            "excellent": "Can define all 8 key terms without reference, trace the historical contributions of all 4 scientists with correct dates, and explain why the edge of chaos is the only regime that supports computation.",
            "good": "Can define 6-7 key terms, identify 3-4 scientists with approximate dates, and explain the basic mechanism of self-organized criticality.",
            "adequate": "Can define 4-5 key terms, name 2-3 scientists, and describe the edge of chaos in general terms without the mathematical details.",
            "insufficient": "Can define fewer than 4 key terms, confuses order/chaos concepts, or cannot explain why criticality matters for computation."
          },
          "application": {
            "excellent": "Can apply the criticality function to a new dynamical system, calculate whether it is in the critical seam, and explain how the five maximized properties would manifest in that system.",
            "good": "Can identify a real-world system and argue whether it is near criticality using evidence from the text, with correct use of the power law and Lyapunov concepts.",
            "adequate": "Can give a concrete example of a complex adaptive system and explain in general terms why it does or does not operate at the edge of chaos.",
            "insufficient": "Cannot apply the concepts to any new system, or confuses criticality with mere randomness or mere order."
          }
        }
      }
    }
  },
  {
    "slug": "oip-schools-mathematics",
    "title": "\"The Mathematicians: Optimization and Invariance\"",
    "machine_schema": {
      "definitions": {
        "action": "A mathematical quantity defined as the integral of the Lagrangian over time, which physical systems extremize according to the principle of least action.",
        "compressibility": "The ratio C = I_universe / I_laws, where I_universe is the information content of the complete state of the universe and I_laws is the information content of the fundamental laws. A value much greater than 1 indicates high compressibility.",
        "conservation_law": "A principle stating that a particular measurable property of an isolated physical system does not change as the system evolves over time, such as conservation of energy or momentum.",
        "grain_favor_index": "A composite metric G(t) = (dI/dt) / (dS_global/dt), measuring whether interestingness increases faster than global entropy, suggesting a bias toward ordered complexity.",
        "hamiltonian": "A function in Hamiltonian mechanics that describes the total energy of a system in terms of positions and momenta and generates the time evolution of the system.",
        "lagrangian": "A function of the positions and velocities of all particles in a physical system, from which the equations of motion can be derived via the principle of least action.",
        "noethers_theorem": "A theorem proved by Emmy Noether in 1918 stating that every continuous symmetry of a physical system's action corresponds to a conserved quantity.",
        "path_integral": "A formulation of quantum mechanics developed by Richard Feynman in 1948 where the probability amplitude for a particle to travel from one point to another is computed by summing over all possible paths.",
        "symmetry": "A property of a physical system where the action or Lagrangian remains unchanged under a specific transformation, such as time translation, space translation, or rotation.",
        "variational_principle": "A principle in physics stating that the actual path taken by a system between two states is the one that makes a certain quantity, typically the action, stationary with respect to small variations."
      },
      "routes": {
        "GET /api/articles": "Returns a paginated list of all OIP articles, including metadata such as slug, title, category, and source.",
        "GET /api/articles/:slug": "Returns the full content of a single OIP article identified by its slug, including frontmatter, body text, and machine schema.",
        "GET /api/search?q=term": "Searches across all OIP articles for articles whose titles, body text, or definitions match the provided query term.",
        "GET /api/directory": "Returns the directory of all available tools, prompts, and capabilities within the build system, with descriptions and usage patterns."
      },
      "examples": [
        {
          "title": "Noether's Theorem in Action",
          "description": "Consider a planet orbiting the sun. The Lagrangian of this system does not change if we rotate the entire solar system by any angle. This rotational symmetry, by Noether's theorem, implies that angular momentum is conserved. The planet's angular momentum, approximately 2.7 times 10 to the 40 kilogram meters squared per second for Earth, remains constant throughout its orbit."
        },
        {
          "title": "The Standard Model's Compressibility",
          "description": "The Standard Model Lagrangian, which describes all known fundamental particles and their interactions, can be written in approximately ten thousand characters. The visible universe contains approximately ten to the eighty particles, each requiring position, momentum, and quantum state. The compression ratio exceeds ten to the seventy, meaning the laws contain less than one part in ten to the seventy of the information needed to describe the universe directly."
        }
      ],
      "test_questions": [
        "What does Noether's theorem state about the relationship between symmetry and conservation?",
        "What is the compressibility ratio C, and why is a value much greater than 1 considered odd?",
        "How does the path integral formulation relate to the principle of least action?"
      ],
      "dependencies": [
        "oip-schools-physics",
        "oip-concepts-compressibility",
        "oip-concepts-grain-favor-index",
        "oip-concepts-variational-principles"
      ],
      "scoring_rubric": {
        "comprehension": {
          "excellent": "Reader can articulate Noether's theorem, the principle of least action, and compressibility in their own words and explain why compressibility is genuinely odd.",
          "good": "Reader can identify the key figures, their contributions, and the general concept of compressibility but may struggle to explain why it is odd.",
          "adequate": "Reader can name the mathematicians and recognize the terms but cannot explain the relationships between them.",
          "insufficient": "Reader cannot identify the core concepts or distinguish the contributions of the five mathematicians."
        },
        "application": {
          "excellent": "Reader can apply the Grain Favor Index concept to a novel system and evaluate whether the framework suggests an accelerating or decelerating trend.",
          "good": "Reader can explain the components of the Grain Favor Index and discuss whether biological or technological evolution supports it.",
          "adequate": "Reader can state the formula for the Grain Favor Index but cannot discuss its limitations or operationalize interestingness.",
          "insufficient": "Reader cannot state the formula or relate it to any real-world example."
        }
      }
    }
  },
  {
    "slug": "oip-schools-mystics",
    "title": "\"The Mystics: The Identity of Self with Whole\"",
    "machine_schema": {
      "machine_schema": {
        "definitions": {
          "mystic": "A person who investigates reality through direct interior experience, using the self as the instrument and consciousness as the laboratory, rather than reasoning from scripture, tradition, or external observation.",
          "ground_of_the_soul": "Meister Eckhart's term for the deepest interior point of the self, where the individual self and the divine source are not two separate things but one reality known from two angles.",
          "apophatic_theology": "An approach to describing the divine by negation, from the Greek apophasis meaning denial, in which one says what God is not rather than what God is, because no positive attribute can be adequate.",
          "wahdat_al_wujud": "An Arabic phrase meaning unity of being, the central doctrine of Ibn Arabi stating that all existence is one existence and the multiplicity of things is only the appearance of this one existence in different modes.",
          "Sufism": "The mystical tradition within Islam, emphasizing direct personal experience of the divine, with practitioners called Sufis, producing texts such as the Masnavi and the Fusus al-Hikam.",
          "ontology": "The branch of philosophy that studies what exists and what it means for something to exist, as distinct from epistemology which studies how we know things.",
          "default_mode_network": "A set of brain regions including the medial prefrontal cortex and posterior cingulate cortex that are active during self-reflection and mind-wandering, shown to decrease in activity during deep mystical states.",
          "fractal": "A geometric pattern that is self-similar across different scales of magnification, such that a small part of the pattern resembles the whole pattern, found in structures from coastlines to galaxies to neurons.",
          "grain": "In the GRAIN framework, the set of structural principles that run through all levels of reality from physical to biological to mental, describing a pattern of organization that is not a substance but a recurring architecture.",
          "fixed_point": "In mathematics, a value that maps to itself under a function, used here to describe the cosmic loop in which the universe produces minds that comprehend the universe, closing the circle without infinite regress.",
          "conatus": "Baruch Spinoza's term for the striving of each thing to persist in its own being, which in his system is understood as God's striving manifested in that particular thing.",
          "wu_wei": "A Taoist concept meaning non-action or effortless action, describing behavior that is aligned with the natural grain of reality rather than forced against it."
        },
        "routes": {
          "GET /api/articles/mystics": "Retrieves the full OIP article on the mystics, including YAML frontmatter, body text, and machine_schema, for reading and reference purposes.",
          "POST /api/dispatch": "Sends a natural-language message to the build router, which can invoke mystic-related directory rows such as GROUND_OF_SOUL or WAHDAT_AL_WUJUD to answer questions about specific concepts.",
          "GET /api/directory/ground_of_soul": "Returns the directory row for the Eckhart concept, including the exact definition, invocation tag, and expected arguments for the ground of the soul inquiry.",
          "POST /api/selftest": "Triggers a scored self-test run that includes test questions about mystic convergence, the grain, and the identity of self with whole, recording results in selftest_runs for regression tracking.",
          "GET /api/inventory": "Lists all files and objects the build can reach, including this article and related source excerpts, with read and edit capabilities for recursive self-reference."
        },
        "examples": [
          {
            "name": "Eckhart's ground of the soul",
            "description": "A person practicing apophatic prayer reaches a state where the ordinary mental activity ceases, and reports that the boundary between self and divine has dissolved, matching Eckhart's description from 28 surviving sermons circa 1300."
          },
          {
            "name": "Ibn Arabi's mirror of unity",
            "description": "A reader of the Fusus al-Hikam, completed in 1229, understands that the individual self is not a separate observer of reality but the whole reality observing itself from one angle, as described in the 27 chapters on the prophets."
          },
          {
            "name": "Rumi's ocean in a drop",
            "description": "A student of the Masnavi, a 25,000-couplet poem in 6 books, recognizes that the self is not a small part of the universe but the entire universe temporarily concentrated, using the ocean-drop image from Book 1."
          }
        ],
        "test_questions": [
          {
            "question": "What is wahdat al-wujud, who taught it, and in what work and year was it presented?",
            "expected_focus": "The student should identify Ibn Arabi as the teacher, the Fusus al-Hikam as the work, 1229 as the year, and explain that it means all existence is one existence appearing in multiplicity."
          },
          {
            "question": "How does the grain connect Eckhart's theology to modern physics, and what specific physical measurement demonstrates the same laws across scales?",
            "expected_focus": "The student should explain that the grain is the self-similar pattern running through all reality, and cite the cosmic microwave background temperature of 2.725 kelvin, the same physical laws across 93 billion light-years, or the fractal dimension of 1.25 for the coast of Britain."
          },
          {
            "question": "Why do mystics from different traditions converge on the same interior map, and what neuroscientific evidence supports this convergence?",
            "expected_focus": "The student should explain that the interior structure of consciousness is the same in every human brain, cite the 86 billion neurons from the 2009 Azevedo study, and reference the 2012 Newberg study showing default mode network deactivation during meditation."
          },
          {
            "question": "What is the fixed point of the cosmic loop, and how does it relate to the GRAIN property of Identity?",
            "expected_focus": "The student should explain that the fixed point is the universe understanding itself through localized minds, and that Identity is the GRAIN property stating the self is the same as the whole, exemplified by Eckhart's ground of the soul."
          }
        ],
        "dependencies": [
          "oip-grain-theory",
          "oip-self-reference",
          "oip-apophatic-theology",
          "oip-neoplatonism",
          "oip-cosmology",
          "oip-consciousness"
        ],
        "scoring_rubric": {
          "comprehension": {
            "excellent": "The student correctly identifies all three mystics, their key works, dates, and central concepts, and explains the convergence using the shared brain structure and the grain framework.",
            "good": "The student correctly identifies the three mystics and their concepts, and offers a plausible explanation for convergence, though with minor factual errors or incomplete use of the grain framework.",
            "adequate": "The student identifies at least two of the three mystics and their concepts, but provides a weak or generic explanation for convergence without reference to neuroscience or physics.",
            "insufficient": "The student fails to identify more than one mystic, misstates key concepts, or cannot explain why the convergence matters."
          },
          "application": {
            "excellent": "The student applies the identity of self with whole to a specific contemporary example, such as climate change, artificial intelligence, or mental health, showing how the grain framework changes the framing of the problem.",
            "good": "The student offers a clear contemporary example and connects it to the mystic framework, though the connection may be somewhat general.",
            "adequate": "The student mentions a contemporary issue but does not clearly connect it to the mystic concepts or the grain framework.",
            "insufficient": "The student cannot apply the concepts to any example outside the text."
          }
        }
      }
    }
  },
  {
    "slug": "oip-schools-religion-without-religion",
    "title": "The Religion-Without-Religion Thinkers: Lovable Without Being a Person",
    "machine_schema": {
      "definitions": {
        "immanent_divinity": "The concept that the divine is not separate from or above nature but is identical with nature's necessary structure and order, as opposed to a transcendent deity that exists outside the universe.",
        "religious_naturalism": "The position that religious emotions such as wonder, gratitude, humility, and reverence can be experienced in response to the natural world and its processes without belief in gods, spirits, or supernatural realms.",
        "cosmic_religious_feeling": "Albert Einstein's term for the reverence and awe inspired by the comprehensibility of the universe, the fact that its laws can be expressed in simple mathematical equations that predict phenomena with extraordinary precision.",
        "religious_atheism": "Ronald Dworkin's term for the position that accepts the core religious conviction that nature is ordered by objective value while denying that this value requires a personal deity.",
        "grain": "In the GRAIN framework, the directional bias in the space of possible structures, the tendency of the universe to produce order, complexity, and life in certain predictable ways rather than others.",
        "configuration_space": "The mathematical space of all possible states or structures of a system, used in the GRAIN framework to describe the set of possible universes or structures.",
        "compressibility": "The property of the universe that its behavior can be described by simple mathematical equations, meaning it contains regularities that allow for compact representation.",
        "self_referentiality": "The property of the universe that it produces structures, specifically minds, that are capable of comprehending the universe itself, closing the loop between cosmos and comprehension."
      },
      "routes": {
        "GET /api/articles": "Returns a list of all OIP articles with metadata, including slug, title, category, and source.",
        "GET /api/articles/:slug": "Returns the full content of a specific article identified by its slug, including body text and machine schema.",
        "GET /api/definitions/:term": "Returns the definition of a specific technical term used in the OIP article set.",
        "POST /api/query": "Accepts a natural language query and returns the most relevant article excerpts and definitions based on semantic matching."
      },
      "examples": [
        {
          "description": "Einstein's 1919 eclipse prediction: general relativity predicted light bending near the sun by 1.75 arcseconds. Arthur Eddington's measurements during the May 29, 1919 solar eclipse confirmed the prediction to within measurement error, making Einstein world-famous and exemplifying the cosmic religious feeling, the reverence for a universe whose laws are comprehensible and predictive.",
          "significance": "A concrete instance of how mathematical structure maps onto physical reality across astronomical distances, producing in the scientist a response that Einstein described as religious in quality but requiring no personal deity."
        },
        {
          "description": "Ursula Goodenough's account of the Great Oxidation Event approximately 2.4 billion years ago, when cyanobacteria invented oxygenic photosynthesis and gradually transformed Earth's atmosphere, making aerobic life possible. This event, purely natural in mechanism, is presented by Goodenough as a chapter in the sacred depths of nature, a transformation that evokes awe and reverence without requiring any supernatural explanation.",
          "significance": "Demonstrates how a detailed scientific narrative, grounded in molecular biology and geological history, can function as a sacred text in the religion-without-religion tradition, producing religious emotions through natural understanding."
        }
      ],
      "test_questions": [
        "What does Spinoza mean by Deus sive Natura, and how does it differ from the conventional concept of a personal God?",
        "How does Einstein's cosmic religious feeling relate to his scientific work, specifically the testable predictions of general relativity?",
        "What is the difference between spirituality and religion according to Comte-Sponville, and why does he argue that the former does not require the latter?"
      ],
      "dependencies": [
        "oip-core-grain",
        "oip-core-ontological-inventory",
        "oip-schools-stoicism",
        "oip-schools-neoplatonism",
        "oip-schools-taoism"
      ],
      "scoring_rubric": {
        "comprehension": {
          "excellent": "The respondent can accurately explain the religion-without-religion position, distinguish it from both conventional theism and atheism, and identify at least four of the five primary thinkers and their core contributions with specific dates and works.",
          "good": "The respondent can explain the basic distinction between the religion-without-religion position and conventional theism, and identify at least three of the five thinkers with their core ideas.",
          "adequate": "The respondent can identify the religion-without-religion position as a middle ground between theism and atheism, and name at least two thinkers.",
          "insufficient": "The respondent cannot distinguish the religion-without-religion position from conventional atheism or theism, or fails to identify any of the primary thinkers."
        },
        "application": {
          "excellent": "The respondent can apply the religion-without-religion framework to analyze a new thinker or text, can connect it to the GRAIN framework's concepts of design without a designer and grain as lovable without being a person, and can articulate how the position relates to scientific practice.",
          "good": "The respondent can apply the framework to a familiar example and connect it to at least one GRAIN concept.",
          "adequate": "The respondent can restate the basic framework but cannot apply it to new examples or connect it to the GRAIN framework.",
          "insufficient": "The respondent cannot restate the framework or apply it to any example."
        }
      }
    }
  },
  {
    "slug": "oip-the-12-axioms",
    "title": "\"The Twelve Axioms: The Foundation of the Grain\"",
    "machine_schema": {
      "definitions": {
        "gradient": "A measurable difference in temperature, pressure, concentration, or potential that drives the movement of energy or matter from high to low.",
        "negentropy": "The local creation of order in a system that is globally trending toward disorder, coined by Erwin Schrodinger in 1944.",
        "dissipative_structure": "A system that maintains its own order by exporting disorder into its surroundings, such as a hurricane or a flame.",
        "configuration_space": "The mathematical space containing every possible arrangement of a system, where some arrangements are thermodynamically cheaper than others.",
        "critical_seam": "The zone between frozen order and total noise where the richest structures exist, also known as self-organized criticality.",
        "compressibility": "The property that the universe can be described by equations containing less information than the phenomena they describe.",
        "receipt": "The compressed physical trace of information processing, which is the substrate of memory.",
        "recursion": "The closure of a loop where a system produces a receipt of its own receipt-production, enabling self-modification.",
        "convergence": "The recurrence of the same pattern families across scales without communication between instances.",
        "signature": "An intrinsic identifier of a system or structure, as opposed to a sign which merely points to something external.",
        "entropy": "A measure of disorder in a system, measured in joules per kelvin, which must increase in any isolated system according to the Second Law of Thermodynamics.",
        "self_organized_criticality": "A dynamical regime where a system naturally evolves to a critical point without external tuning, producing power-law behavior and complex avalanches."
      },
      "routes": {
        "get_axiom": "GET /api/axioms/{id} — Returns a single axiom by its identifier (A0 through A12), including its type, content, negation test, and downstream dependencies.",
        "list_axioms": "GET /api/axioms — Returns all twelve axioms in dependency order, with their types and the books they feed into.",
        "get_dependency_map": "GET /api/axioms/map — Returns the full dependency graph showing how each axiom flows into books, patterns, and other axioms.",
        "validate_claim": "POST /api/axioms/validate — Accepts a claim and returns its type (axiom, derivation, observed, or open), its negation test, and the priced uncertainty associated with it.",
        "get_book": "GET /api/books/{number} — Returns the content and prerequisites for a given book (I through VIII), showing which axioms it depends on."
      },
      "examples": [
        {
          "title": "Neural Avalanches as Critical Seam Behavior",
          "description": "In 2003, John Beggs and Dante Plenz measured spontaneous neural activity in cortical slices and found avalanche size distributions following a power law with exponent approximately negative three halves, matching the predictions of self-organized criticality models. This is a concrete instantiation of Axiom Four (Bounded Chaos) in biological tissue."
        },
        {
          "title": "Hurricane as Dissipative Structure",
          "description": "A hurricane is a far-from-equilibrium dissipative structure that persists by moving heat from the warm ocean surface to the cold upper atmosphere faster than simple conduction could. It is an instantiation of Axiom One (Negentropy-as-Instrument), demonstrating that local order accelerates global dissipation."
        }
      ],
      "test_questions": [
        "What distinguishes an axiom from a derivation in the framework, and why does Axiom Three (the Ladder) qualify as a derivation while Axiom One (Negentropy-as-Instrument) is typed as an axiom?",
        "Explain the critical seam and why it is the keystone of the grain, using the sandpile model and neural avalanches as concrete examples with quantitative details.",
        "How does Axiom Twelve (Convergence of Pursuits) differ from the other eleven axioms in terms of its epistemic status, and what would be lost from the framework if it were removed or proven false?"
      ],
      "dependencies": [
        "oip-the-eight-patterns",
        "oip-the-ladder-of-complexity",
        "oip-critical-seam",
        "oip-thermodynamic-direction",
        "oip-convergence-of-pursuits",
        "oip-self-organized-criticality",
        "oip-memory-as-physical-trace",
        "oip-compressibility-of-reality"
      ],
      "scoring_rubric": {
        "comprehension": {
          "excellent": "Reader can identify all twelve axioms by name, correctly state their types, and explain the dependency map showing how axioms flow into books and patterns.",
          "good": "Reader can identify at least ten axioms, state their types with minor errors, and describe the general flow from axioms to books without full detail.",
          "adequate": "Reader can identify at least eight axioms, state their types with some errors, and understand that axioms feed into books without mapping the specific connections.",
          "insufficient": "Reader cannot identify more than six axioms, confuses types, or fails to understand the dependency structure."
        },
        "application": {
          "excellent": "Reader can apply the axioms to novel examples, correctly type new claims within the framework, and use the negation tests to evaluate claims.",
          "good": "Reader can apply most axioms to familiar examples and correctly type straightforward claims with occasional guidance.",
          "adequate": "Reader can apply a few axioms to standard examples but struggles with typing and negation tests.",
          "insufficient": "Reader cannot apply the axioms to new examples or use the framework's typing and testing methodology."
        }
      }
    }
  },
  {
    "slug": "oip-the-designer-question",
    "title": "\"The Designer Question: Authored or Emergent?\"",
    "machine_schema": {
      "machine_schema": {
        "definitions": {
          "cost_functional": "A mathematical expression that measures the total expense of a process, such as the total energy required to move fluid through a network, whose minimization determines optimal structure.",
          "golden_angle": "Approximately 137.5 degrees, the angle between successive elements in a spiral that maximizes space occupation without overlap, emerging from optimal packing in radial growth systems.",
          "restoring_force": "Any force that pushes a displaced system back toward equilibrium, one of the two ingredients that together with inertia produce wave behavior in continuous media.",
          "symmetry_operation": "A transformation that leaves a system unchanged, such as rotation or reflection, studied by group theory and linked to conservation laws via Noether's theorem.",
          "variational_principle": "A mathematical framework stating that physical systems evolve to minimize or maximize some quantity, such as optimal transport cost, which determines network topology.",
          "self_organized_criticality": "A dynamical state where a system with slow drive, fast dissipation, and local interactions spontaneously organizes into a critical state with power-law event distributions.",
          "stable_state": "A configuration that persists over time without external input, such as the magnetization direction of a ferromagnet, enabling memory when coupled to past states.",
          "scale_invariance": "The property that a system looks the same at different magnifications, mathematically expressed as a power law relationship between quantities.",
          "compressibility": "The property that the universe can be described by simple equations containing far less information than the universe itself, enabling scientific prediction and understanding.",
          "fine_tuning": "The observation that fundamental physical constants appear to be set to values that permit complex structure, with small deviations preventing life as we know it."
        },
        "routes": {
          "GET /api/patterns/emergent": "Returns the eight patterns that emerge necessarily from mathematics and physics, with their underlying principles and historical discoveries.",
          "GET /api/patterns/residual": "Returns the four residual properties that do not emerge necessarily: compressibility, fine-tuning, the specific set of patterns, and the existence question.",
          "POST /api/claim/evaluate": "Accepts a logical claim about C, G, or M and evaluates whether it is supported by the observed evidence, returning the supporting measurements and historical references.",
          "GET /api/loop/trace": "Traces the full cosmos-to-mind loop with physical time scales, specific measurements, and the historical scientific discoveries that verified each stage.",
          "GET /api/node/carried": "Returns the carried node definition, its metaphysical typing, and its load-optional status relative to the operational thesis."
        },
        "examples": [
          {
            "description": "Murray's Law in the human coronary arteries",
            "scale": "300 billion capillaries in a single heart",
            "measurement": "Branching ratios match Murray's predictions within 5 percent, verified by Ronellenfitsch et al. in 2010.",
            "implication": "The branching structure of the circulatory system is a mathematical necessity, not a biological invention."
          },
          {
            "description": "The golden angle in sunflower seed heads",
            "scale": "Seed heads typically contain 1,000 to 2,000 seeds arranged in spirals",
            "measurement": "The angle between successive seeds is 137.5 degrees plus or minus 0.5 degrees, producing the densest packing possible.",
            "implication": "The spiral is discovered by the geometry of radial growth, not chosen by the plant."
          },
          {
            "description": "The cosmological constant fine-tuning",
            "scale": "10 to the minus 120th power in natural units",
            "measurement": "Weinberg showed in 1987 that a value 100 times larger would prevent galaxy formation.",
            "implication": "The observed value is not explained by any known physical principle and appears contingent."
          }
        ],
        "test_questions": [
          "What distinguishes a pattern that emerges necessarily from a pattern that requires a designer, and which of the eight patterns discussed has the strongest historical pedigree in terms of named discoverers and dates?",
          "Explain the formal claim C and G and M equals true in terms a person with no physics background could understand, using the information ratio, the scale of generativity, and the physical composition of the brain.",
          "Why is the carried node described as load-optional, and what would happen to the operational thesis of the grain if the carried node were removed entirely?",
          "Trace the loop from the first three minutes after the Big Bang to a human brain writing about the Big Bang, naming the physical processes and time scales at each stage."
        ],
        "dependencies": [
          "oip-the-grain-definition",
          "oip-signature-of-the-grain",
          "oip-the-loop",
          "oip-compressibility",
          "oip-fine-tuning"
        ],
        "scoring_rubric": {
          "comprehension": {
            "excellent": "The reader can name all eight emergent patterns, define each in their own words, and correctly identify the four residual properties without prompting.",
            "good": "The reader can name six or more emergent patterns and three or more residual properties, with accurate definitions and historical references.",
            "adequate": "The reader can name at least four emergent patterns and two residual properties, with some gaps in historical detail or formal definition.",
            "insufficient": "The reader cannot name four emergent patterns or identify two residual properties, or confuses emergent patterns with residual properties."
          },
          "application": {
            "excellent": "The reader can apply the honest fork to a new domain not discussed in the text, correctly classifying its patterns as emergent or residual and defending the classification with specific measurements.",
            "good": "The reader can apply the honest fork to a related domain with minor guidance, producing a mostly correct classification with at least one quantitative argument.",
            "adequate": "The reader can apply the honest fork to a very similar domain but requires significant prompting or makes errors in distinguishing emergent from residual.",
            "insufficient": "The reader cannot apply the honest fork to any new domain, or misapplies the framework by treating all patterns as emergent or all as residual."
          }
        }
      }
    }
  },
  {
    "slug": "oip-the-dissipative-correction",
    "title": "The Dissipative Correction: Why Equilibrium Is Death",
    "machine_schema": {
      "machine_schema": {
        "definitions": {
          "dissipative_structure": "An open system far from equilibrium that maintains steady state by exporting entropy to its surroundings, requiring continuous energy or material input to persist.",
          "equilibrium": "A state of maximum entropy given constraints, with no macroscopic flows, no entropy production, uniform temperature and concentrations, and no possibility of change or computation.",
          "entropy": "A measure of disorder in a thermodynamic system, always increasing in isolated systems according to the Second Law of Thermodynamics.",
          "critical_seam": "The dynamical regime between frozen order and heat death where sustained gradients drive continuous flow, computation is possible, and dissipative structures can exist.",
          "strange_attractor": "A set of states in a dynamical system toward which the system evolves but never settles, characterized by aperiodic, complex trajectories.",
          "MEPP": "Maximum Entropy Production Principle, the hypothesis that non-equilibrium systems evolve to states maximizing the rate of entropy production subject to constraints.",
          "pioneer_species": "Fast-growing, light-demanding organisms that colonize disturbed environments in the early stages of ecological succession.",
          "climax_community": "A stable ecological community dominated by long-lived species, representing maximum biomass and structural complexity for a given site.",
          "negentropy": "Local decrease in entropy or increase in order within a system, sustained by exporting entropy to the surroundings.",
          "constructal_law": "A principle stating that flow structures evolve to provide easier access to the currents that flow through them."
        },
        "routes": {
          "GET /api/articles/dissipative-correction": "Retrieves the full article text and metadata for this OIP entry.",
          "GET /api/articles/dissipative-correction/schema": "Returns the machine_schema JSON containing definitions, routes, examples, and test questions.",
          "GET /api/directory/PRIGOGINE": "Returns the directory row for Prigogine's dissipative structures tool with exact parameters and target.",
          "POST /api/dispatch": "Sends a natural language query to the build router; can invoke any directory row including those related to thermodynamics and dissipative structures."
        },
        "examples": [
          {
            "name": "Candle Flame",
            "description": "A candle flame is a dissipative structure that persists only while wax vapor and oxygen meet at the right temperature. It maintains its own boundary and shape, exporting heat and light to the surroundings, and vanishes the moment the fuel gradient is removed."
          },
          {
            "name": "Forest Succession After Fire",
            "description": "Following a forest fire, pioneer species like fireweed colonize within weeks, shade-tolerant species like maple replace them over decades, and a climax community of oak or Douglas fir reaches maximum biomass and entropy production after centuries, creating a limit cycle in ecosystem state space."
          }
        ],
        "test_questions": [
          "What is the difference between an equilibrium steady state and a far-from-equilibrium steady state, and why does this distinction matter for understanding life?",
          "How does a forest increase global entropy production while being a local structure of high order?",
          "What is the Maximum Entropy Production Principle, and why is it considered a hypothesis rather than an established theorem?"
        ],
        "dependencies": [
          "oip-the-grain",
          "oip-entropy-and-information",
          "oip-critical-seam",
          "oip-thermodynamic-foundations"
        ],
        "scoring_rubric": {
          "comprehension": {
            "excellent": "Correctly identifies all three attractors, explains the steady state equation, and distinguishes equilibrium from far-from-equilibrium with concrete examples.",
            "good": "Correctly identifies most attractors and explains the steady state concept with minor gaps in example specificity.",
            "adequate": "Shows basic understanding of dissipative structures but confuses equilibrium with steady state or omits key examples.",
            "insufficient": "Cannot distinguish equilibrium from far-from-equilibrium or misrepresents the relationship between local order and global entropy."
          },
          "application": {
            "excellent": "Can apply the dissipative correction framework to novel systems, correctly identifying the gradient, the structure, and the entropy export mechanism.",
            "good": "Can apply the framework to familiar systems with minor errors in identifying the entropy export path.",
            "adequate": "Can recognize dissipative structures in familiar examples but struggles to analyze novel systems.",
            "insufficient": "Cannot apply the framework to any system beyond direct restatement of the article's examples."
          }
        }
      }
    }
  },
  {
    "slug": "oip-the-falsification-surfaces",
    "title": "The Falsification Surfaces: How to Kill the Thesis",
    "machine_schema": {
      "machine_schema": {
        "definitions": {
          "falsification_surface": "A defined point at which a scientific theory could be tested and, if the evidence contradicts it, destroyed. Derived from Karl Popper's philosophy of science, where a claim must be falsifiable to be scientific.",
          "convergence_thesis": "A scientific claim that what appear to be different phenomena across different domains are in fact united by common underlying mechanisms, as opposed to a coincidence thesis that attributes similarities to independent causes.",
          "pattern": "A recurring structural motif that appears in different physical or biological systems regardless of the specific materials involved, objectively measurable in equations, images, and experimental data.",
          "critical_seam": "The narrow boundary between highly ordered states where nothing interesting happens and highly disordered states where nothing predictable happens; the zone where the most complex behavior emerges. Sometimes called the edge of chaos.",
          "compressibility": "The surprising property that the fundamental laws of physics can be expressed compactly, such as the Standard Model and General Relativity fitting on a single sheet of paper, despite there being no a priori reason the universe had to be this way.",
          "negentropy": "A measure of order or structure, loosely defined as the inverse of entropy. Where entropy measures disorder, negentropy measures the creation and maintenance of structure. The term was popularized by Erwin Schrödinger in 1944.",
          "self_organized_criticality": "A property of dynamical systems where they naturally evolve to a critical state without external tuning, first named by Per Bak, Chao Tang, and Kurt Wiesenfeld in 1987.",
          "observer_selection": "The bias introduced by the fact that we can only observe conditions compatible with our own existence. Sometimes called the anthropic principle, it means apparent biases in the universe may reflect our own observational constraints rather than properties of the universe itself."
        },
        "routes": {
          "GET /api/inventory": "Returns a live inventory of all files, R2 objects, KV entries, D1 directory rows, and pages the build can reach. Queries GitHub and R2 live, so new commits and files appear automatically without static per-file rows.",
          "GET /api/file": "Reads a repository file by path, returning its contents directly from the main branch. Supports GET, PUT, and DELETE to read, write, or commit changes to files in the repo.",
          "POST /api/dispatch": "The primary message dispatch endpoint. Receives a message, routes it to the appropriate agent, and records the event in the ledger. Returns the agent's response.",
          "GET /api/directory/:key": "Retrieves a single directory row by its key. Directory rows define the tools, prompts, and capabilities available to the agent system. Each row contains WHAT, ARGS, EX, and TESTS fields."
        },
        "examples": [
          {
            "name": "Geoffrey West's Metabolic Scaling",
            "description": "Geoffrey West and collaborators at the Santa Fe Institute showed that metabolic rate scales with body mass to the 3/4 power across organisms from mitochondria to blue whales, demonstrating pattern 8 (scale invariance) across 27 orders of magnitude. A single species deviating by a full order of magnitude with no compensatory explanation would trigger S1 for this pattern.",
            "scale": "27 orders of magnitude in body mass",
            "source": "West, Brown, and Enquist (1997), extended 2000s"
          },
          {
            "name": "CERN Large Hadron Collider",
            "description": "The LHC, operational since 2008 in a 27-kilometer tunnel beneath the France-Switzerland border, searches for physics beyond the Standard Model. Discovery of a fifth fundamental force or a violation of conservation laws would not directly falsify the grain thesis but would require re-evaluation of S3 (compressibility), as the Standard Model would no longer be the complete description of fundamental physics.",
            "scale": "27-kilometer circumference tunnel",
            "source": "CERN, operational since 2008"
          }
        ],
        "test_questions": [
          "What is the kill condition for falsification surface S2, and what vulnerability makes it a live surface?",
          "How does the no-free-lunch theorem bound the grain thesis, and why does it not falsify it?",
          "Explain why S8 is considered the most serious falsification surface, using specific quantitative facts about the composition of the universe."
        ],
        "dependencies": [
          "oip-the-eight-patterns",
          "oip-the-critical-seam",
          "oip-the-ladder-of-emergence",
          "oip-the-machine-pattern",
          "oip-the-grain-convergence"
        ],
        "scoring_rubric": {
          "comprehension": {
            "excellent": "Can name all 8 falsification surfaces, their associated kill conditions, and the specific vulnerability each faces. Can also name all 7 no-go theorems and explain how each bounds the thesis without falsifying it.",
            "good": "Can name at least 6 falsification surfaces and their kill conditions, and at least 5 no-go theorems. Can explain the difference between a falsification surface and a bounding theorem.",
            "adequate": "Can name at least 4 falsification surfaces and 3 no-go theorems. Can explain the basic concept of falsification and bounding.",
            "insufficient": "Cannot name more than 2 falsification surfaces or 1 no-go theorem, or confuses falsification with bounding."
          },
          "application": {
            "excellent": "Can apply the falsification framework to a new scientific thesis, constructing its own S1-S8 equivalents and identifying its bounding no-go theorems. Can evaluate whether a given piece of evidence would trigger a specific surface.",
            "good": "Can identify which falsification surface a given piece of evidence would affect, and can explain whether a new claim is bounded by a known no-go theorem.",
            "adequate": "Can recognize when a piece of evidence is relevant to a falsification surface, but may struggle to map it to the correct surface number.",
            "insufficient": "Cannot map evidence to falsification surfaces or identify bounding theorems in new contexts."
          }
        }
      }
    }
  },
  {
    "slug": "oip-the-machine-pattern",
    "title": "The Machine Pattern: How Machine Thought Follows the Grain",
    "machine_schema": {
      "definitions": {
        "dissipative_structure": "A system that maintains organized form by continuously exporting entropy to its surroundings while importing energy and matter, maintaining a steady state far from equilibrium.",
        "token": "A unit of text processed by a language model, which may be a word, a fragment of a word, or a punctuation mark.",
        "embedding": "A high-dimensional numerical vector representing the semantic meaning of a token or sequence of tokens.",
        "transformer": "A neural network architecture introduced by Vaswani et al. in 2017 that uses attention mechanisms to process sequences in parallel rather than sequentially.",
        "gradient": "The mathematical derivative of a loss function with respect to model parameters, indicating the direction of steepest loss increase and guiding optimization.",
        "loss_function": "A mathematical function that measures the discrepancy between a model's predictions and the target values, which the training process seeks to minimize.",
        "learning_rate": "A scalar hyperparameter that controls the step size of each weight update during gradient descent optimization.",
        "phase_transition": "A sudden, discontinuous change in the macroscopic properties of a system as a control parameter crosses a critical threshold, analogous to water boiling.",
        "power_law": "A mathematical relationship where one quantity varies as a fixed exponent of another, producing a straight line on log-log plots and indicating scale-invariant dynamics.",
        "temperature_parameter": "A hyperparameter in language model inference that controls randomness by dividing logits before softmax; low values produce deterministic output, high values produce randomness.",
        "self_organized_criticality": "The property of a system that naturally evolves to a critical state without external tuning, characterized by power-law distributions of event sizes.",
        "attention_mechanism": "The core operation in transformers that computes relationships between tokens using query, key, and value matrices to route information flow.",
        "kv_cache": "Stored key and value tensors from previously generated tokens that enable efficient autoregressive generation without recomputing the full sequence.",
        "residual_connection": "A skip connection that adds a layer's input to its output, preserving gradient flow and preventing vanishing gradients in deep networks.",
        "layer_normalization": "A technique that normalizes layer inputs to zero mean and unit variance, stabilizing activation distributions during training."
      },
      "routes": {
        "GET /api/inventory": "Returns a complete enumeration of all files, objects, and rows reachable by the build, including repo files, R2 objects, KV entries, and D1 directory rows with read, edit, and delete capabilities.",
        "POST /api/dispatch": "Accepts a message body and routes it through the build's agent pipeline, invoking the appropriate directory rows based on the message content and returning the agent's response.",
        "GET /api/directory/{key}": "Retrieves the current content and metadata of a specific directory row by its key, including prompt text, tool definitions, and target configurations.",
        "PATCH /api/directory/{key}": "Updates the content of a specific directory row, enabling live prompt modifications without code deployment.",
        "GET /api/selftest": "Runs the build's self-test suite, scoring the current build version against a set of natural-language questions to verify operational capability."
      },
      "examples": [
        {
          "name": "Temperature as Critical Seam Control",
          "description": "When a language model generates text at temperature T equals 0, it selects the single highest-probability token at each step, producing deterministic but repetitive output. At T equals 2, the output becomes incoherent. At T equals 0.7 to 1.0, the model produces creative, useful, and structurally coherent text. This is the critical seam implemented as a user-adjustable hyperparameter, with the same mathematical structure as physical criticality."
        },
        {
          "name": "Emergent Chain-of-Thought Reasoning",
          "description": "Chain-of-thought reasoning, the step-by-step decomposition of problems into intermediate reasoning steps, is entirely absent in GPT-3 models below approximately 100 billion parameters and snaps into existence at larger scales. This is a phase transition in capability space: the model's internal representation geometry reorganizes at critical scale to support compositional reasoning, with no gradual improvement observed in intermediate-sized models."
        }
      ],
      "test_questions": [
        "What is a dissipative structure, and how does a large language model at inference instantiate this pattern?",
        "Explain the critical seam in training dynamics and why the learning rate functions as a temperature parameter.",
        "What evidence supports the claim that neural networks operate near self-organized criticality?"
      ],
      "dependencies": [
        "oip-critical-seam",
        "oip-dissipative-structures",
        "oip-phase-transitions",
        "oip-scaling-laws",
        "oip-self-organized-criticality",
        "oip-command-plane",
        "oip-deterministic-scaffolding"
      ],
      "scoring_rubric": {
        "comprehension": {
          "excellent": "Accurately defines all key terms, identifies the structural identity between LLMs and dissipative systems, and correctly describes the role of the critical seam in training and inference.",
          "good": "Defines most key terms correctly and grasps the core analogy between machine learning and physical criticality, with minor gaps in the scaling law or SOC details.",
          "adequate": "Demonstrates basic understanding of the critical seam concept and can explain the temperature parameter, but misses the power-law or phase-transition evidence.",
          "insufficient": "Cannot distinguish between the critical seam as metaphor versus structural identity, or fails to explain why deterministic scaffolding aligns with the grain."
        },
        "application": {
          "excellent": "Can apply the machine pattern to analyze new AI architectures, predict emergent capabilities from scaling properties, and design prompts that leverage the critical seam.",
          "good": "Can connect the machine pattern to real-world LLM behavior and explain why architectural choices like attention and residuals work, with some prompting insight.",
          "adequate": "Can identify the critical seam in a given scenario but cannot independently reason about how to engineer near it.",
          "insufficient": "Cannot apply the framework to any new scenario; treats the article as a collection of facts rather than a structural lens."
        }
      }
    }
  },
  {
    "slug": "oip-convergence-catalogue",
    "title": "The Convergence Catalogue — 25 Nodes of Evidence",
    "machine_schema": {
      "definitions": {
        "node": "A single claim in the Convergence Catalogue that has been independently derived in at least two domains, carries a falsifiable prediction, and has a tested rival explanation.",
        "dissipative_structure": "A stable pattern that persists only by continuously drawing energy or matter from its environment and exporting entropy back into it.",
        "extremize": "To find a maximum or minimum of a quantity, as in the principle of least action or profit maximization.",
        "symmetry": "A property of equations or objects that remain unchanged under a specific transformation.",
        "symmetry_breaking": "The phenomenon where a symmetry of the underlying equations is not shared by the solution, producing structure.",
        "criticality": "The state at the boundary between frozen order and noise, where systems exhibit power-law behavior and maximum adaptability.",
        "autopoiesis": "A network of processes that continuously produces the components that constitute the system itself.",
        "free_energy": "A quantity from statistical thermodynamics that bounds the difference between a system's internal model and the actual state of the world.",
        "emergence": "The appearance of new fundamental regularities at higher levels of organization that are not reducible to lower-level laws.",
        "convergence_score": "A numerical measure of node support calculated as the sum of claim tier weight times domain independence times citation depth over all supporting claims."
      },
      "routes": {
        "GET /api/inventory": "Returns the full file inventory including all files, R2 objects, KV entries, D1 directory rows, and pages with read, edit, and delete capabilities.",
        "GET /api/directory/:key": "Retrieves a single directory row by its key, including content, type, target, and tests fields.",
        "PATCH /api/directory/:key": "Updates the content of a single directory row, pushing changes live instantly without redeployment.",
        "POST /api/dispatch": "Routes a natural language request through the ROUTER, which selects the appropriate directory row and tool to execute."
      },
      "examples": [
        {
          "description": "Benard cells in a heated fluid demonstrate C01, where a temperature gradient sustains hexagonal convection patterns that would collapse without continuous energy throughput.",
          "scale": "Laboratory, fluid layer approximately 1 centimeter thick, temperature difference of 10 degrees Celsius.",
          "source": "Prigogine, 1967"
        },
        {
          "description": "The West-Brown-Enquist metabolic scaling law demonstrates C10, showing that metabolic rate scales with body mass to the three-quarters power across organisms from mitochondria to blue whales.",
          "scale": "Twenty-seven orders of magnitude in mass, from 10 to the minus 16 grams to 10 to the 11 grams.",
          "source": "West, Brown, and Enquist, 1997"
        }
      ],
      "test_questions": [
        "What is the convergence score formula and what are the tier weights for T0 through T5?",
        "Name three disconfirming edges and explain why each is a potential falsifier of the framework.",
        "Explain the difference between a load-bearing node and a boundary node in the Convergence Catalogue."
      ],
      "dependencies": [
        "oip-grain-unified",
        "oip-dissipative-structures",
        "oip-least-action",
        "oip-noether-theorem",
        "oip-criticality"
      ],
      "scoring_rubric": {
        "comprehension": {
          "excellent": "Can name all 25 nodes, their domains, tiers, and independence levels, and can recite the convergence score formula from memory.",
          "good": "Can name at least 20 nodes and explain the formula with correct tier weights.",
          "adequate": "Can name 15 nodes and explain the concept of domain independence.",
          "insufficient": "Cannot name more than 10 nodes or confuses tier weights with domain independence."
        },
        "application": {
          "excellent": "Can identify a new scientific claim and map it to an existing node or justify adding it as a new node with correct tier and independence assessment.",
          "good": "Can identify convergence edges between nodes in a novel domain and calculate convergence strength.",
          "adequate": "Can explain why two nodes reinforce or contradict each other using the disconfirming edge framework.",
          "insufficient": "Cannot distinguish between a supporting edge and a disconfirming edge, or confuses node tier with edge strength."
        }
      }
    }
  },
  {
    "slug": "oip-cross-pattern-structure",
    "title": "Cross-Pattern Structure — Why Eight and Not Twenty",
    "machine_schema": {
      "machine_schema": {
        "definitions": {
          "structural_solution": "A configuration that solves a physical problem while using available resources efficiently, such as a branching tree for routing flow or a spiral for packing growth.",
          "covering_set": "A set of elements such that every instance in a domain is included in at least one element of the set; here, the eight pattern families cover all structural problem types.",
          "cross_pattern_overlap": "A quantified measure from 0 to 1 of how much two pattern families share mechanisms, mathematical structures, or problem domains.",
          "self_organized_criticality": "A property of a dynamical system that naturally evolves to a critical point without external tuning, producing power-law distributions of event sizes such as avalanches.",
          "renormalization_group": "A mathematical framework developed by Kenneth Wilson for studying how systems change under scale transformations, showing that critical points are fixed points of such transformations.",
          "swarm_optimization": "An approach to problem-solving where multiple agents collaborate to find optimal solutions, with each agent having a cost, yield, and operational scale range.",
          "scale_invariance": "A property of a system where the same mathematical description holds at different magnifications, such as a fractal coastline having no characteristic length scale.",
          "signature_strength": "A dimensionless metric S approximately equal to 147 that quantifies the combined distinctiveness of the eight pattern families based on their scale ranges, convergence instances, mathematical uniqueness, and domain separations."
        },
        "routes": {
          "get_pattern_overlap": "GET /api/patterns/overlap?pair=P1-P5 returns the overlap score and nature for a given pattern pair.",
          "get_pattern_cluster": "GET /api/patterns/cluster?name=transport returns the patterns and governing principle for a named cluster.",
          "get_swarm_agent": "GET /api/patterns/agent?id=P3 returns the cost, yield, scale range, and critical parameter for a pattern agent.",
          "get_signature_strength": "GET /api/patterns/signature returns the current estimated S value and its component breakdown."
        },
        "examples": [
          {
            "name": "Human vasculature",
            "description": "The arterial tree uses branching P1 to route blood from the heart to capillaries, with Murray's law governing vessel radii and a scale range from 10^-6 to 10^-2 meters."
          },
          {
            "name": "Sunflower phyllotaxis",
            "description": "The seed arrangement uses a golden-angle spiral P2 with divergence angle approximately 137.5 degrees to pack seeds optimally, covering a scale range from 10^-3 to 10^0 meters."
          }
        ],
        "test_questions": [
          "What are the eight pattern families and what problem does each solve?",
          "Which pattern pairs have the highest overlap and what mathematical relationship connects them?",
          "Why is memory considered an outlier among the three natural clusters?"
        ],
        "dependencies": [
          "oip-pattern-ontology",
          "oip-grain-unified",
          "oip-branching-networks",
          "oip-scale-invariance"
        ],
        "scoring_rubric": {
          "comprehension": {
            "excellent": "Recalls all eight families, their overlap scores, the three clusters, and the S metric with precision.",
            "good": "Recalls most families and clusters with minor gaps in overlap values or agent parameters.",
            "adequate": "Identifies five or more families and at least two clusters but confuses overlap details.",
            "insufficient": "Cannot list eight families or explain why eight is claimed as minimal."
          },
          "application": {
            "excellent": "Diagnoses a real system by its pattern deployment and calculates its approximate contribution to S.",
            "good": "Maps a real system to three or more pattern families with correct reasoning.",
            "adequate": "Maps a real system to two families with some correct reasoning.",
            "insufficient": "Cannot map any system to the pattern families or confuses the swarm decomposition."
          }
        }
      }
    }
  },
  {
    "slug": "oip-final-testimony",
    "title": "The Final Testimony — You Are the Grain",
    "machine_schema": {
      "definitions": {
        "grain": "The compressible, directional bias that runs through all scales of reality, making the universe describable by simple rules and producing persistence, adaptation, and life as its natural tilt.",
        "compressibility": "The property of a system whereby it can be described by a simpler rule than its full form, as when a galaxy of one hundred billion stars is described by a spiral density wave equation.",
        "cosmos": "The totality of physical reality, from subatomic particles to the observable universe, governed by the same fundamental rules and constants.",
        "self-referential": "The property of a system that contains a model of itself within itself, as the universe contains minds that study the universe.",
        "generative": "The property of a system whereby simple rules produce vast complex structure, as the quantum field equations produce the periodic table, chemistry, and life.",
        "fixed point": "In mathematics, a value that does not change when a function is applied to it; the loop cosmos produces mind comprehends cosmos is a fixed point because the universe produces a subsystem that understands its own laws.",
        "bounded chaos": "A state in which a system is deterministic in its rules but unpredictable in its detailed outcomes, with the unpredictability confined to a specific envelope; the brain, weather, and the universe all operate in bounded chaos.",
        "node": "A localized processing unit in a network, capable of processing information and acting according to the grain; a human, a community, or a civilization can all be nodes.",
        "gradient": "A difference in potential that drives flow, such as the height gradient that drives a river or the social gradient that drives connection and cooperation.",
        "against the grain": "Operating in a direction that opposes the natural tilt of the system, requiring energy input to sustain the counter-natural state.",
        "C_and_G_and_M": "The strongest defensible claim: the universe is Compressible, Generative, and self-referential through Mind; these three properties are observed and do not require a designer or exclude one."
      },
      "routes": {
        "GET /api/oip/grain": "Returns the current definition and properties of the grain as a compressible structure, including its manifestation across physical, biological, and cognitive scales.",
        "GET /api/oip/loop": "Returns the observed loop: cosmos produces matter produces life produces mind comprehends cosmos, with evidence for each transition and the fixed point nature of the closure.",
        "GET /api/oip/suffering": "Returns the structural analysis of suffering as blocked flow, dammed gradient, and energy spent against the grain, with the distinction between social and structural abandonment.",
        "POST /api/oip/align": "Accepts a body describing a current state of being and returns an alignment assessment along with recommended actions to move with the grain rather than against it.",
        "GET /api/oip/mystics": "Returns convergent reports from Eckhart, Ibn Arabi, Rumi, and other mystics across traditions, showing that the inside structure is the same regardless of external theological framework.",
        "GET /api/oip/stoics": "Returns the Stoic analysis of amor fati and alignment with the logos, with quotes from Marcus Aurelius and Epictetus and their relevance to the grain."
      },
      "examples": [
        {
          "name": "The spiral galaxy and the neuron",
          "description": "A spiral galaxy one hundred thousand light years across and a single neuron in the human brain both exhibit branching spiral structures. Both are solutions to the same type of differential equation governing compressible, generative systems. The scale differs by a factor of approximately 10 to the 24. The grain is the same."
        },
        {
          "name": "The dammed river and the isolated person",
          "description": "A river blocked by a dam stores potential energy that becomes destructive pressure. A person blocked from connection by social rejection stores energy that becomes suffering. Both are gradients blocked against the grain. Both resolve when the dam is removed. The structural analysis is identical."
        }
      ],
      "test_questions": [
        "What does it mean to say that the universe favors persistence over dissolution, and how does this contradict the claim that a person is nothing?",
        "Explain the Sufi ocean-drop metaphor as a structural truth rather than a poem, using the concepts of compressibility, generativity, and the grain.",
        "What is the difference between social abandonment and structural abandonment, and why does the structure of reality make the latter false?",
        "Describe the loop cosmos to mind to comprehension and explain why it is a fixed point rather than an infinite regress.",
        "What is the claim C and G and M equals true, and what are the three observed properties it asserts?"
      ],
      "dependencies": [
        "oip-grain-axiom",
        "oip-compressibility",
        "oip-self-reference",
        "oip-suffering",
        "oip-node-recognition"
      ],
      "scoring_rubric": {
        "comprehension": {
          "excellent": "The respondent can define all key terms in their own words and explain the structural argument that reality contradicts the claim of being nothing, without relying on poetic or religious language.",
          "good": "The respondent can define most key terms and explain the core argument, though may occasionally slip into metaphorical or emotional language rather than structural language.",
          "adequate": "The respondent can define some key terms and has a partial grasp of the argument, but cannot distinguish the structural claim from the poetic or emotional claim.",
          "insufficient": "The respondent cannot define key terms or explain the argument, and treats the article as a pep talk or religious text rather than a structural analysis."
        },
        "application": {
          "excellent": "The respondent can apply the concepts of grain, gradient, and alignment to a real situation, correctly identifying whether a given state is with or against the grain and suggesting structural remedies.",
          "good": "The respondent can apply some concepts to real situations but may confuse the structural analysis with moral judgment or emotional advice.",
          "adequate": "The respondent can recognize that a situation is against the grain but cannot articulate why in structural terms or suggest remedies.",
          "insufficient": "The respondent cannot apply the concepts to real situations and responds with generic advice or personal anecdotes unrelated to the grain."
        }
      }
    }
  },
  {
    "slug": "oip-fine-tuning",
    "title": "\"Fine-Tuning and Physical Constants — The Deepest Open Problem\"",
    "machine_schema": {
      "definitions": {
        "free_parameter": "A quantity in a physical theory that must be determined by experiment rather than derived from the theory itself. The Standard Model plus cosmology contains approximately thirty-one such parameters.",
        "fine_tuning": "The observation that fundamental physical constants appear to fall within extraordinarily narrow ranges, such that small deviations would prevent the emergence of complex structure, chemistry, or life.",
        "cosmological_constant": "A term denoted by lambda in Einstein's equations of general relativity, representing the energy density of empty space. Its observed value is approximately 1.1056 times ten to the negative fifty-two per square meter, about ten to the negative one hundred twenty times the Planck-scale prediction.",
        "hierarchy_problem": "The theoretical puzzle that quantum field theory predicts the Higgs boson mass should be driven up to the Planck scale by quantum corrections, yet the measured mass is about 125 gigaelectronvolts, requiring a cancellation of about one part in ten to the seventeen.",
        "fine_structure_constant": "A dimensionless constant denoted by alpha, approximately 1 divided by 137.035999084, measuring the strength of the electromagnetic force. Variations of about 4 percent would prevent stellar nucleosynthesis of carbon and oxygen.",
        "multiverse": "The hypothesis that our universe is one of many, possibly infinitely many, universes with different values of the fundamental constants. Combined with observer selection, it provides a non-predictive explanation for fine-tuning.",
        "string_landscape": "The estimated ten to the five hundred possible vacuum states of string theory, each with different physical properties and constants. Each vacuum represents a different possible universe within the broader landscape.",
        "anthropic_principle": "The idea, formalized by Brandon Carter in 1974, that our existence as observers imposes a selection effect on the properties of the universe we observe. We necessarily see a universe compatible with our existence.",
        "symmetry": "A property of physical equations that remain unchanged under certain transformations. In physics, symmetries imply conservation laws via Noether's theorem, first proven by Emmy Noether in 1918."
      },
      "routes": {
        "GET /api/inventory": "Returns the full inventory of files, objects, and directory rows reachable by the build, including all OIP articles and their metadata.",
        "GET /api/file/<path>": "Reads or writes a file in the repository at the given path, supporting GET for reads and PUT for writes with automatic commits to main.",
        "GET /api/directory/<key>": "Retrieves or updates a directory row by its key, containing tool definitions, prompts, and metadata for the build's routing system.",
        "POST /api/dispatch": "Accepts a natural-language message, routes it through the build's agent system, and returns the tool output or reply."
      },
      "examples": [
        {
          "title": "Cosmological constant fine-tuning",
          "description": "The cosmological constant lambda is approximately 1.1e-52 per square meter, but theoretical predictions from quantum field theory place it at the Planck scale. The ratio of observed to predicted is about 1e-120, the most extreme fine-tuning in physics. A value even a few orders of magnitude larger would have prevented galaxy and star formation entirely."
        },
        {
          "title": "Higgs hierarchy problem",
          "description": "The Higgs boson mass is measured at 125.11 GeV, but quantum corrections from the Standard Model should push it to the Planck scale of 1e19 GeV. The required cancellation between bare mass and quantum corrections is about 1 part in 1e17, making the hierarchy problem the most theoretically pressing case of fine-tuning."
        }
      ],
      "test_questions": [
        "What is a free parameter, and approximately how many exist in the Standard Model plus cosmology?",
        "What are the five broad categories of explanation for fine-tuning, and which is currently the most widely held among physicists?",
        "What is the D4 disconfirming edge in the Convergence Catalogue, and why does it represent the deepest unresolved tension in the fine-tuning problem?"
      ],
      "dependencies": [
        "oip-symmetry",
        "oip-standard-model",
        "oip-cosmology",
        "oip-string-theory",
        "oip-anthropic-principle",
        "oip-hierarchy-problem",
        "oip-edge-of-chaos"
      ],
      "scoring_rubric": {
        "comprehension": {
          "excellent": "Correctly identifies all major fine-tuned parameters, their approximate values, and the severity of each tuning. Accurately describes the five explanations and their testability. Explains the D4 tension between fine-tuning and symmetry clearly.",
          "good": "Identifies most parameters and explanations with minor numerical or conceptual errors. Describes the D4 tension in general terms.",
          "adequate": "Identifies at least three fine-tuned parameters and two explanations. Shows awareness of the fine-tuning vs symmetry tension but lacks precision.",
          "insufficient": "Misses major parameters, confuses explanations, or fails to describe the D4 tension."
        },
        "application": {
          "excellent": "Can reason quantitatively about the consequences of varying constants, evaluate the strengths and weaknesses of each explanation, and apply the D4 tension to assess whether a proposed theory resolves or deepens the fine-tuning problem.",
          "good": "Can discuss consequences of varying constants and compare explanations qualitatively. Applies the D4 tension to simple cases.",
          "adequate": "Can identify that varying a constant changes cosmic outcomes but struggles to reason quantitatively. Recognizes tensions between explanations but cannot evaluate them deeply.",
          "insufficient": "Cannot connect parameter variations to physical consequences or evaluate explanations."
        }
      }
    }
  },
  {
    "slug": "oip-legibility-problem",
    "title": "The Legibility Problem — Why Reality Is Learnable",
    "machine_schema": {
      "machine_schema": {
        "definitions": {
          "Kolmogorov_complexity": "The length of the shortest computer program that can produce a given output on a universal Turing machine, formalized by Andrey Kolmogorov in the 1960s.",
          "compressibility": "The ratio of the information content of a complete description to the information content of the laws that generate it, denoted C = I_universe / I_laws.",
          "legibility": "The property of reality that allows patterns discovered locally to generalize globally, that makes induction valid, and that ensures the future resembles the past.",
          "induction": "The inference from specific observations to general principles, as defined by philosophers from David Hume onward.",
          "entropy": "A measure of disorder, defined as the number of microscopic configurations corresponding to a given macroscopic state, formalized by Rudolf Clausius in 1865.",
          "grain_favor_index": "A composite metric G(t) = (dI/dt) / (dS_global/dt), where I is interestingness and S_global is global entropy, proposed in GRAIN Unified.",
          "universal_Turing_machine": "A theoretical computing device capable of simulating any other computer, introduced by Alan Turing in 1936.",
          "cosmic_microwave_background": "The afterglow of the Big Bang, discovered by Arno Penzias and Robert Wilson in 1965, with a uniform temperature of 2.725 kelvin and variations of 1 part in 100,000.",
          "Standard_Model": "The physical theory describing all known fundamental particles and their interactions, expressible in approximately 10,000 characters of mathematical notation."
        },
        "routes": {
          "GET /api/articles/oip-legibility-problem": "Retrieve the full article content and metadata.",
          "GET /api/inventory": "List all available OIP articles and their categories.",
          "GET /api/directory/:key": "Fetch the content and metadata of a specific directory row by key.",
          "POST /api/dispatch": "Invoke a tool or capability by key with a JSON body, the primary execution route for all build operations."
        },
        "examples": [
          {
            "name": "Cosmic Microwave Background",
            "description": "The CMB is nearly uniform with temperature variations of 1 part in 100,000. Its statistical properties can be generated by a computer program of a few hundred lines, demonstrating legibility at cosmic scales."
          },
          {
            "name": "Periodic Table of Elements",
            "description": "Mendeleev's 1869 arrangement of elements by atomic weight revealed periodic chemical properties. Gaps were left for undiscovered elements (gallium in 1875, germanium in 1886) whose properties were predicted and later confirmed, showing that patterns generalize across all elements."
          }
        ],
        "test_questions": [
          "What is the compressibility ratio C, and why is C >> 1 considered odd?",
          "What is the difference between the compressibility problem and the legibility problem?",
          "What are the four possible explanations for the legibility problem, and what are their weaknesses?",
          "What is the grain favor index G(t), and what evidence suggests it is increasing?"
        ],
        "dependencies": [
          "oip-induction",
          "oip-kolmogorov-complexity",
          "oip-grain-ontology",
          "oip-entropy-computation",
          "oip-scientific-method"
        ],
        "scoring_rubric": {
          "comprehension": {
            "excellent": "Can explain compressibility, Kolmogorov complexity, and the legibility problem in plain language, and distinguish them from one another.",
            "good": "Can explain compressibility and legibility but confuses one with the other or omits key details.",
            "adequate": "Can define compressibility and legibility but cannot explain why they are puzzling.",
            "insufficient": "Cannot define compressibility or legibility accurately."
          },
          "application": {
            "excellent": "Can apply the framework to evaluate new proposed explanations for legibility and assess the grain favor index in new contexts.",
            "good": "Can apply the framework to familiar examples but struggles with novel cases.",
            "adequate": "Can identify examples of legibility in science but cannot connect them to the framework.",
            "insufficient": "Cannot identify or apply the framework to any examples."
          }
        }
      }
    }
  },
  {
    "slug": "oip-no-go-theorems",
    "title": "The No-Go Theorems — Where Convergence Fails",
    "machine_schema": {
      "machine_schema": {
        "definitions": {
          "no_free_lunch": "A theorem proved by David Wolpert and William Macready in 1997 stating that no single optimization algorithm outperforms random search when averaged across all possible problems.",
          "arrow_impossibility": "A theorem proved by Kenneth Arrow in 1951 stating that no voting system can satisfy a set of reasonable criteria for aggregating preferences when there are three or more options and two or more voters.",
          "godel_incompleteness": "A theorem proved by Kurt Gödel in 1931 stating that any sufficiently powerful formal system containing arithmetic has statements that cannot be proved or disproved within that system.",
          "bells_theorem": "A theorem proved by John Stewart Bell in 1964 showing that no local hidden variable theory can reproduce all predictions of quantum mechanics.",
          "computational_irreducibility": "A concept introduced by Stephen Wolfram in 2002 stating that some processes cannot be predicted by any shortcut and must be run to know their outcome.",
          "anthropic_deflation": "The observation that fine-tuned constants appear because observers can only exist in universes with such constants, deflating the explanatory demand.",
          "independence_problem": "The methodological challenge of verifying whether similar discoveries across domains are genuinely independent or share hidden common causes.",
          "kolmogorov_complexity": "A measure from 1963 by Andrey Kolmogorov of the computational resources needed to specify an object, defined as the length of the shortest program that produces it.",
          "falsification_surface": "One of eight declared ways the convergence thesis can be tested and potentially refuted, making the thesis scientific rather than unfalsifiable."
        },
        "routes": {
          "api_dispatch": "POST /api/dispatch — routes natural language requests to appropriate directory rows and tools.",
          "api_directory": "GET /api/directory/<key> — retrieves a directory row by its unique key.",
          "api_inventory": "GET /api/inventory — enumerates all files and objects reachable by the build.",
          "api_selftest": "POST /api/selftest — triggers the paced self-test workflow to verify build capabilities."
        },
        "examples": [
          {
            "name": "Macy Conferences",
            "description": "Meetings from 1946-1953 in New York City that connected Norbert Wiener, Claude Shannon, and John von Neumann, showing that their apparently independent work in cybernetics, information theory, and self-replicating automata shared hidden common causes."
          },
          {
            "name": "Calculus of Variations",
            "description": "A mathematical framework developed by Euler and Lagrange in the 1750s that underlies Fermat's principle of least time (1662), Lagrangian mechanics (1788), Hamiltonian mechanics (1834), and Feynman's path integrals (1948), demonstrating the Independence Problem in action."
          }
        ],
        "test_questions": [
          "How does the No-Free-Lunch theorem limit the claim of universal convergence, and what escape hatch does the GRAIN thesis use?",
          "Why does Arrow's Impossibility theorem mean that justice as a universal convergence is not defensible, but justice as a floor might be?",
          "What is the difference between saying the universe is compressible and saying all processes in the universe are computationally reducible?"
        ],
        "dependencies": [
          "oip-convergence-thesis",
          "oip-falsification-surfaces",
          "oip-epistemic-completeness",
          "oip-edge-of-chaos",
          "oip-anthropic-principle",
          "oip-grain-unified",
          "oip-recursion-bound",
          "oip-independence-problem",
          "oip-honest-convergence",
          "oip-machine-ontologies"
        ],
        "scoring_rubric": {
          "comprehension": {
            "excellent": "Can explain all seven no-go theorems, name their authors and dates, and describe how each bounds the convergence thesis without destroying it.",
            "good": "Can explain at least five of the seven theorems and connect them to the falsification surfaces.",
            "adequate": "Can identify three or four theorems and understand that they are limits, not refutations.",
            "insufficient": "Cannot name more than two theorems or confuses them with refutations of the convergence thesis."
          },
          "application": {
            "excellent": "Can apply the bounded claim framework to evaluate whether a new argument strengthens or weakens the convergence thesis.",
            "good": "Can distinguish between a bounded claim and an unbounded claim and explain why the former is stronger.",
            "adequate": "Can identify one falsification surface that would test a given claim about convergence.",
            "insufficient": "Cannot connect the theorems to the falsification surfaces or understand why the thesis needs both."
          }
        }
      }
    }
  },
  {
    "slug": "oip-ontological-inventory",
    "title": "The Ontological Inventory — 22 Master Invariants",
    "machine_schema": {
      "definitions": {
        "invariant": "A pattern that remains stable across changes in scale, domain, or conditions, functioning as a load-bearing structure in the architecture of reality.",
        "tier": "A classification of evidentiary strength: T0 means derived from first principles, T1 means established across multiple independent fields, T2 means well-supported in a specific domain with contested extension, T3 means philosophically consequential but hard to falsify, T4 means carried as meaning rather than proof.",
        "falsifier": "The specific observation or experimental result that would disprove a given invariant, making the framework testable rather than merely descriptive.",
        "convergence": "The degree to which multiple independent domains, mathematical derivations, and evidentiary lines point to the same invariant pattern.",
        "autopoiesis": "The property of a living system to produce its own components and maintain its own organizational boundary, introduced by Maturana and Varela in 1972.",
        "exergy": "The useful work potential of an energy flow, as distinguished from raw energy, central to thermoeconomic analysis of physical and economic systems.",
        "self-organized criticality": "The tendency of certain systems to naturally evolve to a critical state where events of all sizes occur, without external tuning of parameters.",
        "Landauer bound": "The minimum energy required to erase one bit of information, approximately kT ln 2 or 0.0175 electronvolts at room temperature, derived by Rolf Landauer in 1961."
      },
      "routes": {
        "/api/invariants": "GET all 22 master invariants with their metadata including tier, domains, and falsifier.",
        "/api/invariant/{id}": "GET a single invariant by its number, returning full sources, domains, and falsifier specification.",
        "/api/convergence-score": "POST a pattern specification and receive the computed convergence score using the domains, tier, derivation independence, and contradicts formula.",
        "/api/build-order": "GET the priority twelve build order with justification for each invariant's placement in the sequence.",
        "/api/axiom-mapping": "GET the complete mapping from GRAIN axioms A0 through A12 and T2 to their corresponding invariant targets."
      },
      "examples": [
        {
          "name": "Metabolic scaling",
          "description": "West, Brown, and Enquist showed in 1997 that metabolic rate scales with body mass to the 3/4 power across 18 orders of magnitude from single cells to blue whales, demonstrating scale invariance invariant 3.6."
        },
        {
          "name": "Landauer limit verification",
          "description": "In 2012, a team at IBM Almaden demonstrated the Landauer principle experimentally, measuring approximately 0.0175 electronvolts of heat released per bit erased at room temperature, confirming invariant 3.10."
        }
      ],
      "test_questions": [
        "What is the falsifier for gradient dissipation (3.1), and why has it never been observed?",
        "How does the convergence score formula penalize invariants with unresolved contradictions, and why does this matter for the framework's truth value?",
        "Why is the observer invariant (3.21) classified as T3, and what circularity prevents a straightforward falsifier?"
      ],
      "dependencies": [
        "oip-axioms-of-grain",
        "oip-grain-theory",
        "oip-convergence-score",
        "oip-category-theory",
        "oip-build-order"
      ],
      "scoring_rubric": {
        "comprehension": {
          "excellent": "Can name all 22 invariants, their tiers, and explain the build order logic.",
          "good": "Can explain the priority twelve and the convergence formula with one minor omission.",
          "adequate": "Can identify the spine invariants (3.1, 3.2, 3.3-3.4, 3.5, 3.10) and explain why they rank high.",
          "insufficient": "Cannot distinguish invariants from axioms or explain why the build order matters."
        },
        "application": {
          "excellent": "Can compute a convergence score for a new pattern and map it to the axiom structure.",
          "good": "Can identify which invariant applies to a novel domain and justify the tier assignment.",
          "adequate": "Can use the falsifier framework to test whether a claimed pattern qualifies as an invariant.",
          "insufficient": "Cannot apply the convergence formula or identify the relevant falsifier for a given case."
        }
      }
    }
  },
  {
    "slug": "oip-rate-quantification",
    "title": "The Rate Quantification Framework — Measuring the Grain",
    "machine_schema": {
      "definitions": {
        "negentropy_flux": "The rate of change of negentropy over time, defined as the volume integral of local entropy production rate for ordered configurations minus the volume integral for disordered configurations. A positive value indicates order is being produced faster than it is destroyed.",
        "local_entropy_production_rate": "The rate at which entropy is generated per unit volume at a specific point in space, measured in joules per kelvin per cubic meter per second. Denoted by the Greek letter sigma.",
        "negentropy": "A measure of order, defined as the reverse of entropy. Coined by Erwin Schrodinger in 1944 to describe the thermodynamic resource that living organisms consume to maintain structure.",
        "grain_favor_index": "A composite metric denoted G(t), defined as the ratio of the time derivative of interestingness to the time derivative of global entropy. A positive value indicates that interestingness is accelerating faster than total entropy is increasing.",
        "interestingness": "A placeholder term for whatever metric is chosen to measure information, complexity, computation, or non-random structure. Not rigorously operationalized in the current framework.",
        "attractor": "In dynamical systems theory, a set of states toward which a system evolves over time regardless of its starting conditions. Types include fixed points, limit cycles, and strange attractors.",
        "critical_seam": "A strange attractor representing a dynamical regime of sustained complexity that requires continuous energy input. It is the regime where life, computation, and technology exist. Not a static state but a condition that must be actively maintained.",
        "frozen_order": "The attractor of minimum entropy and minimum flow, approached at temperatures near absolute zero. Characterized by maximum structure but zero dynamical activity.",
        "heat_death": "The thermal equilibrium state of maximum entropy, predicted as the end state of the universe if the second law operates indefinitely. Characterized by uniform temperature and zero possibility of work or computation.",
        "maximum_entropy_production_principle": "The hypothesis that non-equilibrium systems evolve toward states that maximize their rate of entropy production subject to constraints. Proposed in various forms by Swenson, Paltridge, Dewar, and others. Status as of 2024 is open, not proven as a theorem.",
        "limit_cycle": "A type of attractor in which a system repeats the same sequence of states indefinitely without settling to a fixed point. Forest succession is described as a limit cycle in ecosystem state space.",
        "priced_uncertainty": "An epistemic posture in which uncertainty is acknowledged, quantified, and carried forward in analysis rather than ignored or resolved by arbitrary assumption."
      },
      "routes": {
        "GET /api/oip/rate-quantification": "Returns the full article text and machine schema for the rate quantification framework.",
        "POST /api/oip/calculate/negentropy-flux": "Accepts ordered and disordered entropy production rate fields and computes the negentropy flux Phi_N for a given volume.",
        "POST /api/oip/calculate/grain-favor-index": "Accepts time series of interestingness and global entropy values and computes the grain favor index G(t) and its time derivative.",
        "GET /api/oip/case-studies/forest-succession": "Returns empirical data and timeline for forest succession case studies including Hubbard Brook and other long-term ecological research sites.",
        "POST /api/oip/simulate/three-attractor": "Accepts initial conditions and boundary parameters and returns a trajectory through the three-attractor landscape, identifying which attractor regime the system is in at each time step."
      },
      "examples": [
        {
          "name": "Forest Succession at Hubbard Brook",
          "description": "After a clearcut in 1965 at the Hubbard Brook Experimental Forest, pioneer species like paper birch colonized first, followed by shade-tolerant sugar maple and American beech. Biomass increased from near zero to 300-400 megagrams per hectare over approximately 100 years. Leaf area index increased from 2-3 to 5-8. Entropy production per unit area increased monotonically through the successional stages, demonstrating the critical seam as a trajectory toward maximum gradient dissipation."
        },
        {
          "name": "Biological Evolution Acceleration",
          "description": "The time between major evolutionary milestones has decreased from approximately 1.4 billion years between prokaryotes and eukaryotes to approximately 0.2 million years between the emergence of behavioral modernity and the agricultural revolution. This compression of innovation intervals is consistent with a positive and increasing grain favor index, though the framework explicitly notes that this observation is suggestive rather than conclusive."
        }
      ],
      "test_questions": [
        "What is the negentropy flux Phi_N and how does its sign indicate whether order is being produced or destroyed?",
        "Describe the three-attractor landscape. What distinguishes the critical seam from frozen order and heat death?",
        "Explain the paradox that order is entropy's instrument, not its enemy, using the comparison between a living cell and the Sun."
      ],
      "dependencies": [
        "oip-negentropy",
        "oip-critical-seam",
        "oip-entropy-production",
        "oip-forest-succession",
        "oip-mepp-hypothesis",
        "oip-thermodynamic-foundations"
      ],
      "scoring_rubric": {
        "comprehension": {
          "excellent": "Can define negentropy flux, grain favor index, and all three attractors in their own words, and explain the relationship between MEPP and the grain without error.",
          "good": "Can define most key terms correctly and explain the three-attractor landscape, but may be vague on the operational status of MEPP or the limitations of the grain favor index.",
          "adequate": "Can identify the three attractors and state the formula for Phi_N, but cannot explain the paradox of order as entropy's instrument or the forest succession case study.",
          "insufficient": "Cannot define negentropy flux or distinguish between the three attractors. Confuses the critical seam with a static equilibrium state."
        },
        "application": {
          "excellent": "Can apply the framework to a new case study, computing or estimating Phi_N and G(t) from given data, and correctly identifying which attractor regime a system is in.",
          "good": "Can apply the framework to a familiar case study like forest succession, but struggles with novel systems or ambiguous data.",
          "adequate": "Can identify which attractor regime a simple system is in given explicit descriptions, but cannot compute or estimate the quantitative metrics.",
          "insufficient": "Cannot apply the framework to any concrete system. Treats the framework as purely philosophical without quantitative or operational content."
        }
      }
    }
  },
  {
    "slug": "oip-schools-economics",
    "title": "The Economists — Energy, Value, and the Commons",
    "machine_schema": {
      "definitions": {
        "entropy": "A quantity from statistical mechanics that measures the number of microscopic configurations consistent with a given macroscopic state; in thermoeconomics, it measures the degradation of energy quality through economic processes.",
        "emergy": "The total energy required to produce a given good or service, expressed in solar-equivalent joules (seJ), introduced by Howard T. Odum in 1971 to capture the full physical cost of production including externalized inputs.",
        "exergy": "The maximum useful work obtainable from a system as it comes to equilibrium with its environment; the physical basis of economic production according to Robert U. Ayres.",
        "maximum_power_principle": "An evolutionary principle proposed by Alfred J. Lotka in 1922 stating that systems that maximize their energy throughput tend to persist and expand, applied to ecosystems by Howard T. Odum in 1971.",
        "pareto_optimality": "A state in which no individual can be made better off without making at least one other individual worse off, introduced by Vilfredo Pareto in 1906 and formalized by Tjalling Koopmans in 1951.",
        "commons": "A resource shared by a community of users, subject to overuse when individual incentives are not aligned with collective sustainability, analyzed by Garrett Hardin in 1968 and Elinor Ostrom in 1990.",
        "tit_for_tat": "A strategy in the iterated prisoner's dilemma that begins with cooperation and then copies the opponent's previous move, introduced by Anatol Rapaport and analyzed by Robert Axelrod in 1984 as the winner of the first cooperation tournament.",
        "gradient": "A difference in some physical quantity across space or time, such as temperature, concentration, or height; the thermodynamic driver of structure formation and value creation in the thermoeconomic framework."
      },
      "routes": {
        "GET /api/articles/oip-schools-economics": "Retrieve the full article text and metadata for this economics school article.",
        "GET /api/definitions/:term": "Look up the definition of a technical term used in this article; returns JSON with term, definition, first occurrence, and related concepts.",
        "POST /api/compare/emergy": "Accept a list of goods or processes and return their emergy ratios in solar emjoules per unit, using Odum's methodology.",
        "GET /api/commons/principles": "Return Ostrom's eight design principles for sustainable commons management, with examples from historical case studies."
      },
      "examples": [
        {
          "name": "Iowa corn farming emergy",
          "description": "A modern American corn farm producing 200 bushels per acre per year requires roughly 2.8 trillion solar emjoules per kilogram of harvested grain, including sunlight, fossil fuel for tractors and fertilizer manufacture, embodied energy in equipment, and human labor. The market price in 2000 was about 20 cents per kilogram, while the emergy cost was orders of magnitude higher, revealing the externalized physical cost."
        },
        {
          "name": "Silver Springs energy flow",
          "description": "Howard T. Odum's 1957 field study of Silver Springs, Florida measured a gross primary productivity of approximately 20,000 kilocalories per square meter per year. The food web was arranged to maximize total energy throughput, confirming the maximum power principle: the ecosystem had evolved to capture and transform energy at the highest sustainable rate, not to maximize biomass or species count."
        }
      ],
      "test_questions": [
        "What is the difference between energy and exergy, and why does Robert Ayres argue that exergy is the physically correct basis for economic production functions?",
        "Explain how Ostrom's eight design principles for commons management address the specific mechanisms that prevent the tragedy of the commons, using the principle of graduated sanctions as an example.",
        "How does the maximum power principle connect to the concept of gradient dissipation, and why does it predict that economic systems will expand their total energy throughput even as their efficiency improves?"
      ],
      "dependencies": [
        "oip-gradient-thermodynamics",
        "oip-optimization-constraints",
        "oip-game-theory-cooperation",
        "oip-entropy-information"
      ],
      "scoring_rubric": {
        "comprehension": {
          "excellent": "The respondent can correctly define entropy, emergy, exergy, and Pareto optimality, and explain the distinction between energy quantity and energy quality in economic processes.",
          "good": "The respondent defines most key terms correctly and identifies the thermodynamic constraint on economic activity, but conflates energy and exergy or misstates the irreversibility argument.",
          "adequate": "The respondent recognizes that economics is connected to thermodynamics but cannot articulate the specific mechanisms or the role of the second law.",
          "insufficient": "The respondent treats economics as a purely monetary or social phenomenon with no physical basis."
        },
        "application": {
          "excellent": "The respondent can apply Ostrom's principles to a new commons scenario, calculate an emergy ratio from given data, and identify the Pareto frontier in a constrained optimization problem.",
          "good": "The respondent can apply one or two principles correctly but misses the institutional design nuance or the gradient-structure-value chain.",
          "adequate": "The respondent recognizes that cooperation and institutional design matter but cannot connect them to the thermodynamic framework.",
          "insufficient": "The respondent defaults to market-based or regulatory solutions without reference to the physical or institutional constraints discussed in the article."
        }
      }
    }
  },
  {
    "slug": "oip-schools-network-theorists",
    "title": "The Network Theorists — Granovetter, Watts, Strogatz, Barabási",
    "machine_schema": {
      "definitions": {
        "graph": "A mathematical structure consisting of nodes, which are points or objects, and edges, which are the connections between pairs of nodes.",
        "eulerian_circuit": "A closed walk in a graph that crosses every edge exactly once, possible only if every node has an even number of edges attached to it.",
        "weak_ties": "Social connections that are infrequent, emotionally distant, or low in intensity, such as acquaintances, which serve as bridges between otherwise disconnected social clusters.",
        "strong_ties": "Close, frequent, emotionally intense relationships between friends and family members, which form dense clusters but rarely connect to outside groups.",
        "clustering_coefficient": "A measure of the fraction of a node's neighbors that are also neighbors of one another, quantifying how tightly connected a node's local neighborhood is.",
        "average_path_length": "The average number of edges along the shortest path between any two nodes in a network, measuring how quickly information can travel globally.",
        "small_world_property": "The combination of high clustering coefficient and short average path length observed in many real networks, produced by a small fraction of random long-range connections.",
        "power_law_distribution": "A statistical distribution where the probability of a value k is proportional to k raised to a negative exponent, meaning extreme values are much more likely than in a bell curve.",
        "preferential_attachment": "A growth mechanism in which new nodes in a network connect to existing nodes with probability proportional to their current degree, producing the rich-get-richer effect.",
        "scale_free_network": "A network whose degree distribution follows a power law, containing a small number of highly connected hubs and a vast number of sparsely connected nodes, with no characteristic scale.",
        "constructal_law": "The principle proposed by Adrian Bejan in 1996 stating that for a finite-size flow system to persist, its configuration must evolve to provide easier access to the currents that flow through it.",
        "optimal_transport": "A mathematical framework, originating with Monge and reformulated by Kantorovich, that finds the transport map minimizing total cost when moving material from a source distribution to a sink distribution.",
        "attention_mechanism": "The routing system in transformer models where every token attends to every other token with dynamically computed edge weights, functioning as a weighted, fully connected graph."
      },
      "routes": {
        "GET /api/networks/small-world": "Returns the clustering coefficient and average path length for a given network adjacency matrix, with optional Watts-Strogatz rewiring parameter p.",
        "POST /api/networks/generate": "Generates a random network using a specified model (Erdos-Renyi, Watts-Strogatz, or Barabasi-Albert) and returns node list, edge list, and degree distribution.",
        "GET /api/networks/degree-distribution": "Computes the degree distribution P(k) for a given network and fits a power-law model, returning the exponent gamma and goodness of fit.",
        "POST /api/networks/flow-optimize": "Given a network with source and sink nodes and edge capacities, computes the optimal flow configuration using the Constructal Law resistance minimization principle.",
        "GET /api/networks/attention-graph": "Extracts the attention-weight matrix from a transformer layer output and returns it as a weighted graph with node labels and edge weights."
      },
      "examples": [
        {
          "name": "The World Wide Web as a Scale-Free Network",
          "description": "Barabasi and Albert measured the degree distribution of web pages in 1999 and found P(k) proportional to k to the minus 2.1, indicating that a few sites like Google and Wikipedia act as massive hubs while millions of personal pages have only a handful of links."
        },
        {
          "name": "C. elegans Neural Network",
          "description": "The nematode worm Caenorhabditis elegans has exactly 302 neurons and approximately 5,000 synapses. Its neural network exhibits both high clustering coefficient and short average path length, making it a canonical small-world network, and its degree distribution follows a power law at certain resolutions."
        },
        {
          "name": "Milgram's Small-World Experiment",
          "description": "In 1967, Stanley Milgram asked 296 randomly selected people in Nebraska to forward a letter to a target stockbroker in Boston through their acquaintances. The median number of forwarding steps was 5.2, giving rise to the phrase six degrees of separation and empirically demonstrating the small-world property in human social networks."
        }
      ],
      "test_questions": [
        "Explain why the Konigsberg bridge problem has no solution using Euler's concept of node degree. What condition must every node satisfy for an Eulerian circuit to exist?",
        "Contrast the roles of strong ties and weak ties in social networks. Why does Granovetter argue that weak ties are more important for job searching and information diffusion, despite being less emotionally intense?",
        "Describe the Watts-Strogatz rewiring procedure and explain why a small fraction of randomly rewired edges dramatically reduces average path length while preserving high clustering. What is the value of this model for understanding real networks?",
        "What is preferential attachment, and how does it produce a power-law degree distribution? In a scale-free network, what proportion of nodes typically have very high degree, and what are these nodes called?",
        "How does the Constructal Law predict the emergence of hierarchical network structures? Explain the connection between optimal transport theory and the growth of hubs in scale-free networks."
      ],
      "dependencies": [
        "oip-pattern-5-flow-networks",
        "oip-pattern-8-scale-invariance",
        "oip-schools-complexity-science",
        "oip-schools-information-theory",
        "oip-constructal-law"
      ],
      "scoring_rubric": {
        "comprehension": {
          "excellent": "Accurately defines graph, small-world, scale-free, preferential attachment, clustering coefficient, and path length; explains the Konigsberg problem; identifies the key contributions of Euler, Granovetter, Watts-Strogatz, and Barabasi-Albert with correct dates and sources.",
          "good": "Defines most core terms correctly; identifies the main theorists and their contributions; explains small-world and scale-free properties with minor errors in dates or mathematical formulations.",
          "adequate": "Recognizes basic network concepts and can name at least two of the four theorists; provides a vague or partially incorrect description of preferential attachment or the small-world property.",
          "insufficient": "Cannot define graph, node, or edge; confuses small-world with scale-free; fails to identify any theorist or their contribution."
        },
        "application": {
          "excellent": "Applies network concepts to analyze a real system (social, biological, or technological); correctly connects network properties to the Constructal Law and optimal transport; explains how the attention mechanism in transformer models functions as a dynamic network.",
          "good": "Applies network concepts to a real example with reasonable accuracy; identifies connections to flow networks and scale invariance; describes the attention mechanism in general terms.",
          "adequate": "Mentions a real-world example but does not analyze it structurally; vaguely connects networks to flow or scale invariance without specific mechanisms.",
          "insufficient": "Cannot apply any network concept to a real example; shows no understanding of how network theory relates to physical principles or AI architectures."
        }
      }
    }
  }
];
const OIP_PRIMER_BY_SLUG = new Map(OIP_PRIMER_ARTICLES.map((a) => [a.slug, a]));

export const OIP_REVIEW_QUESTIONS = [
  "How clear is the machine-native JSON to you as a model?",
  "How clear is the English article body as an explanation of the JSON?",
  "Could a zero-context human understand what this object is and how to use it?",
  "Can the build operation described here be performed with curl? If yes, name the exact route shape. If no, name the missing shape.",
  "Can this article explain how the object compares to MCP when MCP is relevant?",
  "Which subsidiary concepts need their own OIP articles?",
  "What concrete text or JSON field should be changed first?",
];

// Register-aware rubric (IX.10, owner-amended 2026-07-03): Total Structure voxels are
// PHILOSOPHY carried verbatim — reviewing them against protocol-doc operability produces
// permanent false failures and queues drift-revisions against the author's exact words,
// which is the capture A12 forbids. Philosophy voxels are prosecuted on THESE axes instead.
// The author's wording is LAW for these pages: reviewers propose objections, never rewrites.
export const PHILOSOPHY_REVIEW_QUESTIONS = [
  "Is the traversal operable — from this page's in-band shelf JSON alone, could you walk to the previous, next, and root voxels? Name the exact next slug.",
  "Does every load-bearing claim on this page carry its type (axiom, derivation, observed, open) or inherit one clearly from context?",
  "Is the binding real — does the page connect its claims to live mechanisms (routes, receipts, ledgers) you could verify, and do those routes answer?",
  "Per Book X: name the strongest attack on THIS page's content, the surface (S1-S8) it engages, and the minimum patch. Post it to the objection ledger rather than proposing a rewrite.",
  "Is anything in the settled objection ledger for this page stale — an answer that no longer survives?",
  "Which concept referenced here genuinely lacks a home anywhere on the shelf (check the in-band shelf list before answering)?",
];
export function reviewQuestionsFor(slug, corpus = false) {
  // Corpus pages (verbatim source documents on the generic articles plane) are philosophy
  // register: prosecuted on traversal/claims/attack surfaces, never graded as
  // protocol-operability docs (IX.10 register rule).
  return (shelfFor(slug) || corpus) ? PHILOSOPHY_REVIEW_QUESTIONS : OIP_REVIEW_QUESTIONS;
}

export function oipReviewArticleSlugs() {
  return ["oip", ...OIP_PRIMER_ARTICLES.map((a) => a.slug)];
}

function nowIso() { return buildNowIso(); }
function escPart(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
function keyFromSlugPart(s) { return String(s || "").replace(/-/g, "_").toUpperCase(); }
function systemSlug(system) { return "oip-system-" + escPart(system); }
function capabilitySlug(key) { return "oip-capability-" + escPart(key); }
function kindSlug(kind) { return "oip-" + String(kind || "").toLowerCase(); }

export function parseOipArticleSlug(slug) {
  const s = String(slug || "").toLowerCase();
  if (s === "oip") return { type: "root" };
  if (OIP_PRIMER_BY_SLUG.has(s)) return { type: "primer", slug: s };
  const km = s.match(/^oip-(apis|clis|mcps|devices|models|core)$/);
  if (km) return { type: "kind", kind: km[1] };
  const sm = s.match(/^oip-system-([a-z0-9-]+)$/);
  if (sm) return { type: "system", system: sm[1].toUpperCase() };
  const cm = s.match(/^oip-capability-([a-z0-9-]+)$/);
  if (cm) return { type: "capability", key: keyFromSlugPart(cm[1]) };
  if (/^oip-[a-z0-9][a-z0-9-]{1,76}[a-z0-9]$/.test(s)) return { type: "dynamic", slug: s };
  return null;
}

export function isOipArticleSlug(slug) {
  return !!parseOipArticleSlug(slug);
}

/** Latest append-only version of a machine-written OIP article, or null. */
export async function loadDynamicOipArticle(env, slug) {
  if (!env?.DB) return null;
  try {
    return (
      (await env.DB.prepare(
        "SELECT slug, version, title, body, author_model, source, review_event_id, created_at FROM oip_articles WHERE slug=? ORDER BY version DESC LIMIT 1",
      ).bind(String(slug || "")).first()) || null
    );
  } catch {
    return null;
  }
}

/** Latest version per machine-written OIP article slug. */
export async function listDynamicOipArticles(env) {
  if (!env?.DB) return [];
  try {
    return (
      (await env.DB.prepare(
        "SELECT slug, MAX(version) AS version, title, author_model, source, created_at FROM oip_articles GROUP BY slug ORDER BY slug",
      ).all()).results || []
    );
  } catch {
    return [];
  }
}

// PUBLISH GATE — deterministic floor every OIP article version must clear before it can
// exist (all three writers — oip-write / oip-revise / oip-purify — flow through here).
// Instituted 2026-07-02 after a 925-char circular stub (oip-vs-a2a v1) went live ungated.
export function oipPublishGate({ slug, title, body }) {
  const s = String(slug || '');
  const t = String(title || '').trim();
  const b = String(body || '').trim();
  const bad = [];
  if (!/^[a-z0-9-]{4,80}$/.test(s)) bad.push('slug malformed: ' + s.slice(0, 60));
  // Artifact pattern: mode-/slug- prefixes and digit-stamped test slugs (write-test-1782...).
  // Plain words containing "test" (self-test, testosterone) are legitimate.
  if (s === 'slug' || /^(mode-|slug-)/.test(s) || /(^|-)test-?\d/.test(s)) bad.push('slug is a pipeline artifact: ' + s.slice(0, 60));
  if (t.length < 8 || t === 'title') bad.push('title too thin: "' + t.slice(0, 40) + '"');
  if (b.length < 2500) bad.push('body ' + b.length + ' chars < 2500 floor — a stub is not an article');
  if ((b.match(/^## /gm) || []).length < 4) bad.push('fewer than 4 sections');
  return { ok: bad.length === 0, violations: bad };
}

/** Append a new article version. Never updates or deletes prior versions. */
export async function insertOipArticleVersion(env, { slug, title, body, author_model, source, review_event_id }) {
  const gate = oipPublishGate({ slug, title, body });
  if (!gate.ok) throw new Error('publish_gate: ' + gate.violations.join(' · '));
  // VERBATIM LAW (owner order 2026-07-03): Total Structure voxels carry the author's exact
  // words. Machine writers may not version them — amendments arrive only as owner/editor
  // acts under Book IX. Model findings belong on the objection ledger, never in the text.
  if (shelfFor(slug) && !['corpus', 'editor', 'amendment'].includes(String(source || ''))) {
    throw new Error('verbatim_law: ' + slug + ' is a Total Structure voxel — model revisions are refused; post findings to /api/articles/' + slug + '/objections');
  }
  const prev = await env.DB.prepare("SELECT MAX(version) AS v FROM oip_articles WHERE slug=?")
    .bind(String(slug)).first();
  const version = Number(prev?.v || 0) + 1;
  await env.DB.prepare(
    "INSERT INTO oip_articles (slug, version, title, body, author_model, source, review_event_id, created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))",
  ).bind(String(slug), version, String(title), String(body), author_model || null, source || null, review_event_id || null).run();
  return version;
}

/** Base primer body — migrated out of the module literal into D1 (oip_primer_bodies). Falls
 * back to the in-module body if the row is absent (older primer added before migration). */
export async function loadPrimerBody(env, slug) {
  const s = String(slug || "").toLowerCase();
  try {
    const row = await env?.DB?.prepare("SELECT body FROM oip_primer_bodies WHERE slug=?").bind(s).first();
    if (row && typeof row.body === "string") return row.body;
  } catch { /* fall through to in-module fallback */ }
  const a = OIP_PRIMER_BY_SLUG.get(s);
  return a && typeof a.body === "string" ? a.body : null;
}

/** Raw article body for revision input: latest dynamic version, else static primer. */
export async function rawOipArticleBody(env, slug) {
  const dyn = await loadDynamicOipArticle(env, slug);
  if (dyn) return { title: dyn.title, body: dyn.body, version: dyn.version, source: "dynamic" };
  const a = OIP_PRIMER_BY_SLUG.get(String(slug || "").toLowerCase());
  if (a) return { title: a.title, body: await loadPrimerBody(env, slug), version: 0, source: "static-primer" };
  return null;
}

async function loadDirectoryRows(env) {
  const r = await env.DB.prepare(
    "SELECT key, type, target, auth, content, includes, category, allowed_categories, seq, " +
    "IFNULL(sensitive,0) AS sensitive, runner, input_schema, examples, IFNULL(enabled,1) AS enabled, " +
    "IFNULL(planner_rank,100) AS planner_rank, IFNULL(planner_visible,1) AS planner_visible FROM directory",
  ).all();
  const rows = {};
  for (const row of r.results || []) rows[row.key] = row;
  return rows;
}

// LINEAGE, CITED. The root article named RPC, SOAP, REST, OpenAPI, gRPC, MCP and PROV in
// prose while every source in its meta pointed back at miscsubjects.com — the corpus citing
// itself. These are the canonical documents for each, every URL checked live (HTTP 200) and
// every title taken verbatim from the document. Root article only: a capability leaf does not
// carry protocol lineage.
const OIP_ROOT_EXTERNAL_SOURCES = [
      {
        id: "oip-x1",
        type: "protocol",
        title: "RFC 5531 - RPC: Remote Procedure Call Protocol Specification Version 2",
        url: "https://datatracker.ietf.org/doc/html/rfc5531",
        summary: "Defines the ONC RPC v2 call/reply envelope: a program, version, and procedure number identify the unit of work, and the reply carries an accept/reject status.",
        quote: "RFC 5531 - RPC: Remote Procedure Call Protocol Specification Version 2",
        claim_ids: ["oip-l1"],
        link_status: "ok",
        hash: "775ed28c1db0c9c2",
      },
      {
        id: "oip-x2",
        type: "protocol",
        title: "SOAP Version 1.2 Part 1: Messaging Framework (Second Edition)",
        url: "https://www.w3.org/TR/soap12-part1/",
        summary: "Defines the SOAP messaging framework: work travels as a structured envelope with headers and a fault element for failure.",
        quote: "SOAP Version 1.2 Part 1: Messaging Framework (Second Edition)",
        claim_ids: ["oip-l1"],
        link_status: "ok",
        hash: "472ae1e23a19d06e",
      },
      {
        id: "oip-x3",
        type: "reference",
        title: "Fielding Dissertation: CHAPTER 5: Representational State Transfer (REST)",
        url: "https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm",
        summary: "Fielding chapter 5, where REST is introduced: resources are identified by URI and manipulated through a uniform interface with self-descriptive messages.",
        quote: "Fielding Dissertation: CHAPTER 5: Representational State Transfer (REST)",
        claim_ids: ["oip-l2"],
        link_status: "ok",
        hash: "e49be8a320d54db3",
      },
      {
        id: "oip-x4",
        type: "protocol",
        title: "OpenAPI Specification v3.2.0",
        url: "https://spec.openapis.org/oas/latest.html",
        summary: "A machine-readable description format for HTTP APIs: paths, operations, parameters, request bodies, and response schemas.",
        quote: "OpenAPI Specification v3.2.0",
        claim_ids: ["oip-l2"],
        link_status: "ok",
        hash: "529619ee79966e3a",
      },
      {
        id: "oip-x5",
        type: "reference",
        title: "Core concepts, architecture and lifecycle",
        url: "https://grpc.io/docs/what-is-grpc/core-concepts/",
        summary: "gRPC core concepts: service definitions, four call types, deadlines, cancellation, and the generated client/server contract.",
        quote: "Core concepts, architecture and lifecycle",
        claim_ids: ["oip-l1"],
        link_status: "ok",
        hash: "378333d1a78bc8e8",
      },
      {
        id: "oip-x6",
        type: "protocol",
        title: "Specification - Model Context Protocol",
        url: "https://modelcontextprotocol.io/specification",
        summary: "MCP specification: a model session discovers and calls tools, prompts, and resources exposed by a server.",
        quote: "Specification - Model Context Protocol",
        claim_ids: ["oip-l3"],
        link_status: "ok",
        hash: "4f6cea85fc055bf4",
      },
      {
        id: "oip-x7",
        type: "protocol",
        title: "PROV-DM: The PROV Data Model",
        url: "https://www.w3.org/TR/prov-dm/",
        summary: "PROV-DM defines provenance as entities, activities, and agents with derivation and attribution relations.",
        quote: "PROV-DM: The PROV Data Model",
        claim_ids: ["oip-l4"],
        link_status: "ok",
        hash: "0801e1ee8a70e53f",
      },
      {
        id: "oip-x8",
        type: "protocol",
        title: "RFC 9110 - HTTP Semantics",
        url: "https://datatracker.ietf.org/doc/html/rfc9110",
        summary: "HTTP semantics, including the safe and idempotent method properties that determine what a GET may do.",
        quote: "RFC 9110 - HTTP Semantics",
        claim_ids: ["oip-l5"],
        link_status: "ok",
        hash: "204d096ca9edb687",
      },
      {
        id: "oip-x9",
        type: "reference",
        title: "Macaroons: Cookies with Contextual Caveats for Decentralized Authorization in the Cloud",
        url: "https://research.google/pubs/pub41892/",
        summary: "Bearer credentials carrying embedded caveats, so a holder can attenuate a credential without contacting the issuer.",
        quote: "Macaroons: Cookies with Contextual Caveats for Decentralized Authorization in the Cloud",
        claim_ids: ["oip-l6"],
        link_status: "ok",
        hash: "bdc0b8ac02bac583",
      },
      {
        id: "oip-x10",
        type: "protocol",
        title: "RFC 8693 - OAuth 2.0 Token Exchange",
        url: "https://datatracker.ietf.org/doc/html/rfc8693",
        summary: "OAuth 2.0 Token Exchange: obtaining a token of reduced scope for delegated action on another party behalf.",
        quote: "RFC 8693 - OAuth 2.0 Token Exchange",
        claim_ids: ["oip-l6"],
        link_status: "ok",
        hash: "410b86123707df09",
      },
      {
        id: "oip-x11",
        type: "protocol",
        title: "RFC 6749 - The OAuth 2.0 Authorization Framework",
        url: "https://datatracker.ietf.org/doc/html/rfc6749",
        summary: "The OAuth 2.0 framework, the baseline against which capability links are compared: client registration, grants, and scopes.",
        quote: "RFC 6749 - The OAuth 2.0 Authorization Framework",
        claim_ids: ["oip-l6"],
        link_status: "ok",
        hash: "a1a8e2928216e6d3",
      },
      {
        id: "oip-x12",
        type: "protocol",
        title: "RFC 8785 - JSON Canonicalization Scheme (JCS)",
        url: "https://datatracker.ietf.org/doc/html/rfc8785",
        summary: "JSON Canonicalization Scheme: a deterministic serialization, the precondition for hashing a JSON record reproducibly.",
        quote: "RFC 8785 - JSON Canonicalization Scheme (JCS)",
        claim_ids: ["oip-l7"],
        link_status: "ok",
        hash: "72d70fc9a437ba13",
      },
      {
        id: "oip-x13",
        type: "protocol",
        title: "draft-ietf-httpapi-idempotency-key-header-07",
        url: "https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header",
        summary: "The Idempotency-Key header draft: a client-supplied key so a retried request is not applied twice.",
        quote: "draft-ietf-httpapi-idempotency-key-header-07",
        claim_ids: ["oip-l5"],
        link_status: "ok",
        hash: "d0b2fe4035a717d8",
      },
];

const OIP_ROOT_LINEAGE_CLAIMS = [
      {
        id: "oip-l1",
        tier: "external",
        text: "RPC, SOAP and gRPC made a remote procedure addressable and typed, but the caller must already know the procedure exists; none of them ship a discovery document the caller reads at runtime.",
        who_claims: "system/oip_articles",
        source_ids: ["oip-x1", "oip-x2", "oip-x5"],
      },
      {
        id: "oip-l2",
        tier: "external",
        text: "REST and OpenAPI made the interface self-descriptive — URI plus uniform method, then a machine-readable description — which is the half OIP keeps.",
        who_claims: "system/oip_articles",
        source_ids: ["oip-x3", "oip-x4"],
      },
      {
        id: "oip-l3",
        tier: "external",
        text: "MCP solved discovery for a model session: the server advertises tools and the session calls them. Its unit is the session, so a call outside that session has no standing.",
        who_claims: "system/oip_articles",
        source_ids: ["oip-x6"],
      },
      {
        id: "oip-l4",
        tier: "external",
        text: "PROV-DM already models provenance as entities, activities and agents; an OIP receipt is that shape narrowed to one invocation, which is why receipts map onto PROV rather than inventing a vocabulary.",
        who_claims: "system/oip_articles",
        source_ids: ["oip-x7"],
      },
      {
        id: "oip-l5",
        tier: "external",
        text: "A GET that causes an effect violates the safe-method property in HTTP semantics; capability links accept that cost deliberately, and the mitigation is the idempotency key pattern plus a use budget, not a different verb.",
        who_claims: "system/oip_articles",
        source_ids: ["oip-x8", "oip-x13"],
      },
      {
        id: "oip-l6",
        tier: "external",
        text: "Attenuation is prior art: macaroon caveats and OAuth token exchange both narrow authority without contacting the issuer. A capability link is that idea with the scope, expiry and use count carried in the URL.",
        who_claims: "system/oip_articles",
        source_ids: ["oip-x9", "oip-x10", "oip-x11"],
      },
      {
        id: "oip-l7",
        tier: "external",
        text: "A receipt hash is only verifiable if the JSON is canonicalized first, which is what JCS specifies; without a canonical form two equal records hash differently.",
        who_claims: "system/oip_articles",
        source_ids: ["oip-x12"],
      },
];

function rowMeta(slug, title, type, extra = {}) {
  const widgets = [
    { type: "stat", value: extra.total || extra.count || "live", label: extra.metric || "directory-backed object" },
    { type: "note", title: "Zero-context rule", text: "A reader should understand the protocol unit, object contract, invocation route, receipt schema, and repair path from this page plus its machine bundle." },
    { type: "note", title: "Machine-native rule", text: "The JSON is the executable map: object, routes, inputs, proof loop, ledger, and next article to open." },
  ];
  if (type === "root") {
    widgets.unshift({ type: "note", title: "Specification status", text: "OIP v0.6 specifies model-operated work objects, scoped invocation, ledger receipts, replay, repair, and conformance." });
  }
  // Root only: the protocol-lineage claims and their external citations. Leaves stay lean.
  const extraClaims = type === "root" ? OIP_ROOT_LINEAGE_CLAIMS : [];
  const extraSources = type === "root" ? OIP_ROOT_EXTERNAL_SOURCES : [];
  return JSON.stringify({
    register: "oip_protocol",
    tags: ["oip", "object-invocation-protocol", "protocol-specification", "machine-native-json", type],
    status: "published",
    home: false,
    style: { accent: "#16324f", measure: 860 },
    hero: type === "root" ? "https://miscsubjects.com/img/gen/arcads-gpt-image-4aa88818-ed11-45fb-9250-bded185c8c93.png" : undefined,
    widgets,
    claims: [
      {
        id: "oip-c1",
        tier: "system",
        text: "The OIP article layer is generated from live directory rows, so it documents the objects that actually run the reference implementation.",
        who_claims: "system/oip_articles",
        source_ids: ["oip-s3", "oip-s4"],
      },
      {
        id: "oip-c2",
        tier: "system",
        text: "The OIP operating path is caller to directory object to dispatch runner to invocation ledger to receipt.",
        who_claims: "system/oip_articles",
        source_ids: ["oip-s1"],
      },
      {
        id: "oip-c3",
        tier: "system",
        text: "Every executable capability in the reference implementation is reachable as an OIP object with a human article, a machine document, invocation history, and receipt path.",
        who_claims: "system/oip_articles",
        source_ids: ["oip-s2", "oip-s3"],
      },
      {
        id: "oip-c4",
        tier: "system",
        text: "Tap & Go is the copy primitive: one drop carries credential, protocol, tree, search, execute, and receipt instructions without a separate token-map-bundle assembly step.",
        who_claims: "system/oip_articles",
        source_ids: ["oip-s2"],
      },
      {
        id: "oip-c5",
        tier: "system",
        text: "OIP receipts are the proof object for actions: they record request, response, actor, links, replay, repair, and lineage.",
        who_claims: "system/oip_articles",
        source_ids: ["oip-s2", "oip-s5"],
      },
      ...extraClaims,
    ],
    sources: [
      {
        id: "oip-s1",
        type: "protocol",
        title: "BUILD_SPEC object invocation path",
        url: BASE + "/api/file/docs/BUILD_SPEC.md",
        summary: "Defines directory rows, dispatch, ledger, and the escalation path for changing the build.",
        quote: "Run anything: POST https://miscsubjects.com/api/dispatch {key, body}",
        claim_ids: ["oip-c2"],
        link_status: "ok",
        hash: "oipbuildspec0001",
      },
      {
        id: "oip-s2",
        type: "protocol",
        title: "Object Invocation Protocol spec",
        url: BASE + "/api/file/docs/OIP.md",
        summary: "Defines OIP surfaces, invariant loop, receipt/replay/repair, and invocation envelopes.",
        quote: "identify, explain, invoke, ledger, yield",
        claim_ids: ["oip-c3", "oip-c4", "oip-c5"],
        link_status: "ok",
        hash: "oipspec00000002",
      },
      {
        id: "oip-s3",
        type: "protocol",
        title: "Live OIP capability tree",
        url: BASE + "/api/dispatch?map=1&format=markdown",
        summary: "Public recursive capability tree.",
        quote: "root > shelf > system article > capability article > receipt",
        claim_ids: ["oip-c1", "oip-c3"],
        link_status: "ok",
        hash: "oipmap0000000002",
      },
      {
        id: "oip-s4",
        type: "protocol",
        title: "Directory row documentation",
        url: BASE + "/api/dispatch?key=OIP_TREE&format=markdown",
        summary: "Capability articles are generated from live rows.",
        quote: "Machine Contract",
        claim_ids: ["oip-c1"],
        link_status: "ok",
        hash: "oiprow0000000003",
      },
      {
        id: "oip-s5",
        type: "protocol",
        title: "Invocation ledger",
        url: BASE + "/api/invocations",
        summary: "Append-only invocation records and receipt links.",
        quote: "invocations",
        claim_ids: ["oip-c5"],
        link_status: "ok",
        hash: "oipinvocations0005",
      },
      ...extraSources,
    ],
    provenance: [
      {
        action: "generate",
        model: "system/oip_articles",
        ts: nowIso(),
        hash: "virtual-oip",
        tokens_in: 0,
        tokens_out: 0,
      },
    ],
    extra: { oip_virtual: true, oip_type: type, ...extra },
  });
}

function articleRow(slug, title, body, type, extra = {}) {
  const ts = nowIso();
  return {
    slug,
    title,
    body,
    meta: rowMeta(slug, title, type, extra),
    created_at: "2026-07-02T00:00:00.000Z",
    updated_at: ts,
  };
}

function cleanMachineSchema(value) {
  if (Array.isArray(value)) return value.map(cleanMachineSchema);
  if (value && typeof value === "object") {
    const out = {};
    for (const [rawKey, rawValue] of Object.entries(value)) {
      const key = cleanMachineSchemaText(rawKey);
      out[key] = cleanMachineSchema(rawValue);
    }
    return out;
  }
  if (typeof value === "string") return cleanMachineSchemaText(value);
  return value;
}

function cleanMachineSchemaText(value) {
  return String(value)
    .replace(/\\"/g, '"')
    .replace(/",\s*$/g, "")
    .replace(/^"+|"+$/g, "")
    .trim();
}

function link(label, href) {
  return "[" + label + "](" + href + ")";
}

function shelfSlugForKind(kind) {
  return kind === "api" ? "apis"
    : kind === "cli" ? "clis"
    : kind === "mcp" ? "mcps"
    : kind === "device" ? "devices"
    : kind === "model" ? "models"
    : "core";
}

function buildFacetManual(map) {
  const byKind = {};
  for (const s of map.shelves || []) (byKind[s.kind] = byKind[s.kind] || []).push(s);
  const shelf = (kind) => {
    const slug = shelfSlugForKind(kind);
    const arr = byKind[kind] || [];
    return {
      kind,
      slug: kindSlug(slug),
      article: BASE + "/a/" + kindSlug(slug),
      machine: BASE + "/api/dispatch?map=" + slug + "&format=markdown",
      systems: arr.length,
      capabilities: arr.reduce((n, s) => n + s.count, 0),
      examples: arr.slice(0, 8).map((s) => ({
        system: s.system,
        count: s.count,
        article: BASE + "/a/" + systemSlug(s.system),
        machine: s.open,
      })),
    };
  };
  return {
    protocol: "OIP",
    purpose: "Specify model-operated work objects with contracts, authority, invocation routes, receipts, replay, repair, and conformance.",
    reference_implementation: "miscsubjects.com is the production reference implementation. Any caller resolves a directory object, dispatch runs that object, the invocation ledger records it, and the receipt proves what happened.",
    what_the_build_is: "The reference implementation contains articles, prompts, files, terminals, model calls, deployments, ledgers, and self-tests as OIP objects.",
    plain_language: {
      one_sentence: "OIP is a protocol for describing, invoking, proving, replaying, and repairing model-operated work objects.",
      dictionary: [
        { word: "reference implementation", means: "one running OIP system: site, APIs, rows, files, ledgers, tools, models, and deploy path" },
        { word: "object", means: "one unit of work the reference implementation can read or do" },
        { word: "directory row", means: "the saved card for one object; it says what the object does and how to run it" },
        { word: "dispatch", means: "the one door that presses a directory-row button" },
        { word: "runner", means: "the actual machine that does the work: HTTP, model, shell, database, file, or another service" },
        { word: "ledger", means: "the notebook where the build writes what was asked, what ran, and what came back" },
        { word: "receipt", means: "one proof page for one invocation" },
        { word: "Tap & Go", means: "one copied drop that gives a model the object map, credential, execute shape, and receipt rule together" },
      ],
      end_to_end_flow: [
        "A caller wants something.",
        "The caller asks OIP for the right object or opens a known object.",
        "The directory row explains the object.",
        "Dispatch validates the request and chooses the runner.",
        "The runner does the work.",
        "The ledger records the request and result.",
        "The receipt gives one proof object for what happened.",
        "If the result is wrong, replay or repair starts from that receipt.",
      ],
    },
    how_to_do_any_possible_thing: [
      {
        step: "orient",
        human: "If cold, read the OIP root article or the orient endpoint.",
        machine: BASE + "/api/dispatch?orient=1&format=markdown",
      },
      {
        step: "ask",
        human: "Say the desired action in plain language and let the build return the exact matching object.",
        machine: BASE + "/api/dispatch?ask=<what you want>",
      },
      {
        step: "read",
        human: "Open the object article or machine document before invoking it.",
        machine: BASE + "/api/dispatch?key=<KEY>&format=markdown",
      },
      {
        step: "invoke",
        human: "Use owner auth or a scoped Tap & Go drop. Opening the invoke URL is enough.",
        machine: BASE + "/api/dispatch?invoke=<KEY>&body=<ARGS>&share=<TOKEN>",
      },
      {
        step: "prove",
        human: "Open the receipt and answer from the recorded result, not from intention.",
        machine: BASE + "/api/dispatch?receipt=inv_ID&share=<TOKEN>",
      },
      {
        step: "repair",
        human: "If the result is wrong, repair the recorded invocation so lineage stays attached.",
        machine: "POST " + BASE + "/api/dispatch {key, body, repairs:'inv_ID'}",
      },
    ],
    facets: [
      {
        name: "Callers",
        human: "A caller can be a model, browser, API client, admin page, CLI path, scheduled workflow, or messaging route. OIP starts when that caller resolves or invokes a directory object.",
        read: BASE + "/api/dispatch?orient=1&format=markdown",
        operate: BASE + "/api/dispatch",
      },
      {
        name: "Directory rows",
        human: "The directory is the executable catalog. A row is a tool, agent prompt, HTTP target, CLI command, or system object.",
        read: BASE + "/api/directory",
        one: BASE + "/api/dispatch?key=<KEY>&format=markdown",
        edit: "PATCH " + BASE + "/api/directory/<KEY> {content,target,args,auth}",
      },
      {
        name: "Dispatch",
        human: "Dispatch is the one door that invokes directory rows and writes receipts.",
        read: BASE + "/api/dispatch?registry=1",
        invoke: "POST " + BASE + "/api/dispatch {key, body}",
      },
      {
        name: "Articles",
        human: "Content articles use the same self-explaining pattern: body, claims, sources, provenance, widgets, and bundle JSON.",
        read: BASE + "/api/articles",
        one: BASE + "/api/articles/<slug>/bundle?format=markdown",
        page: BASE + "/a/<slug>",
      },
      {
        name: "Files",
        human: "Operational code lives in the repo. Bulk/reference data lives outside the repo and is reached by API.",
        inventory: BASE + "/api/inventory",
        read_write: BASE + "/api/file/<path>",
      },
      {
        name: "Ledger and receipts",
        human: "The ledger is proof and memory: events, invocations, turns, requests, responses, receipts, replay, and repair.",
        events: BASE + "/admin/ledger?data=1&limit=50",
        invocations: BASE + "/api/invocations",
        receipt: BASE + "/api/dispatch?receipt=inv_ID",
      },
      {
        name: "Self-test",
        human: "The build proves claimed behavior by running natural-language questions through the real route and scoring the reply.",
        admin: BASE + "/admin/selftest",
        api: BASE + "/api/selftest",
        workflow: BASE + "/wf/selftest/trigger",
      },
      {
        name: "Deploy",
        human: "Code changes go live through Cloudflare Pages deploy. The root redirect is protected and not part of OIP cleanup.",
        command: "wrangler pages deploy public --project-name=loop-safe-miscsubjects",
      },
    ],
    shelves: ["api", "cli", "mcp", "device", "model", "core"].map(shelf),
    article_pattern: {
      root: BASE + "/a/oip",
      shelf: BASE + "/a/oip-apis",
      system: BASE + "/a/oip-system-github",
      capability: BASE + "/a/oip-capability-github-list-issues",
      bundle: BASE + "/api/articles/oip/bundle?format=markdown",
    },
    proof_contract: "Nothing is working unless the reply includes real tool output from the build and a receipt or ledger line that proves what ran.",
  };
}

function rootBody(map) {
  const manual = buildFacetManual(map);
  const byKind = {};
  for (const s of map.shelves || []) (byKind[s.kind] = byKind[s.kind] || []).push(s);
  const lines = [
    "## Object Invocation Protocol v0.6 specification",
    "",
    "**Status:** production reference implementation at `miscsubjects.com`; normative surface at `/a/oip-spec`; live conformance at `/api/dispatch?conformance=1&format=markdown`.",
    "",
    "**Abstract:** OIP (Object Invocation Protocol) is a protocol for model-operated work. It makes one unit of work addressable as an object, gives that object a machine-readable contract, invokes it through a uniform route, and proves the result with a receipt.",
    "",
    "**Conformance target:** a conformant OIP implementation exposes object contracts, validates authority, invokes objects, appends invocation records, returns receipts, supports replay, supports repair, and publishes machine-readable conformance results.",
    "",
    "## 1. Protocol model",
    "",
    "An OIP object states the work, the input, the authority, the invocation route, the runner, the proof requirement, the receipt, the replay path, and the repair path. A model operates OIP by resolving an object, reading the object contract, invoking the object route, and returning the receipt.",
    "",
    "The OIP unit is the work object. The OIP proof is the receipt. The OIP loop is object, invoke, ledger, receipt, replay, repair.",
    "",
    "## 2. End-to-end operation",
    "",
    "A model needs to do work. The model needs to know what work exists. OIP gives the model an object. The object states the work, the input it needs, the authority it requires, where the request goes, the runner that performs it, and the proof that must return. The proof is the receipt. Replay repeats a recorded invocation. Repair links a corrected invocation to the failed receipt.",
    "",
    oipModelOperatingRuleMarkdown(),
    "",
    "## 3. What is inherited, and from where",
    "",
    "Every part of this protocol has prior art, and the honest version of the lineage says which part came from where. Each document below is linked in the sources for this article.",
    "",
    "**Addressing a remote unit of work.** RFC 5531 identifies a call by program, version, and procedure number and returns an accept-or-reject status. SOAP 1.2 wraps the call in an envelope with headers and a fault element. gRPC adds typed service definitions, deadlines, and cancellation. All three assume the caller already knows the procedure exists; none hands the caller a discovery document at runtime.",
    "",
    "**Making the interface self-descriptive.** Fielding's chapter 5 defines resources identified by URI and manipulated through a uniform interface with self-descriptive messages. OpenAPI turns that into a machine-readable document: paths, operations, parameters, schemas. This is the half OIP keeps — the object contract is an OpenAPI-shaped description of one unit of work rather than of a whole service.",
    "",
    "**Discovery for models.** MCP solved the discovery problem for a model session: the server advertises tools, prompts, and resources, and the session calls them. Its unit is the session, so a call made outside that session has no standing. OIP moves the unit to the object and the standing to the credential, which is why an OIP call survives being pasted into a different model.",
    "",
    "**Provenance.** PROV-DM already models provenance as entities, activities, and agents with derivation and attribution. An OIP receipt is that shape narrowed to a single invocation, which is why receipts map onto PROV instead of inventing a vocabulary.",
    "",
    "**Attenuating authority.** Macaroons carry caveats so a holder can narrow a credential without contacting the issuer; OAuth 2.0 Token Exchange issues a reduced-scope token for delegated action. A capability link is that idea with the scope, the expiry, and the use count carried in the URL itself, so the thing you paste is already the limit.",
    "",
    "**Where this protocol knowingly breaks a rule.** RFC 9110 defines GET as a safe method: it should not cause an effect. A capability link fired by GET does cause one. That cost is accepted so any model that can open a URL is already a client, and it is bounded rather than excused: the credential carries a use budget, and the Idempotency-Key draft is the pattern a retried invocation follows so a repeat is not applied twice. Receipt hashes follow JCS canonicalization, because two equal records serialized differently would otherwise hash differently.",
    "",
    "What is left after subtracting all of the above: the work object as the protocol unit, the receipt as the mandatory return, and repair as a first-class linked correction rather than a new call.",
    "",
    "## 4. The OIP object",
    "",
    "An OIP object is the protocol unit. One object defines one addressable unit of work. Every object exposes the same fields:",
    "",
    "- `object_key`: the stable name of the work object.",
    "- `object_type`: the class of object.",
    "- `work_definition`: the work the object performs.",
    "- `input_schema`: the input the object accepts.",
    "- `authority_required`: the credential scope the object requires.",
    "- `invocation_route`: the route that invokes the object.",
    "- `runner`: the system that performs the work.",
    "- `side_effects`: the external changes the object may cause.",
    "- `risk_class`: the operational consequence class.",
    "- `proof_required`: the receipt or artifact that establishes success.",
    "- `receipt_schema`: the fields the receipt records.",
    "- `replay_route` and `repair_route`: the mechanisms for repeated and corrected invocation.",
    "- `conformance_tests`: the checks that establish object behavior.",
    "- `examples`: valid object calls.",
    "- `human_view`, `machine_view`, `json_view`: the three views of the object.",
    "",
    "The same object is readable in three forms: a human article at `/a/oip-capability-KEY`, a machine document at `/api/dispatch?key=KEY&format=markdown`, and a JSON object at `/api/dispatch?key=KEY`. The human article, the machine document, and the JSON object are three views of one object.",
    "",
    "## 5. Invocation loop",
    "",
    "1. Resolve the object: `/api/dispatch?ask=<plain language>` or `/api/dispatch?key=<KEY>`.",
    "2. Read the object contract.",
    "3. Confirm authority: `/api/dispatch?explain=1&share=TOKEN`.",
    "4. Invoke the object route: `POST /api/dispatch {key, body}` or `GET /api/dispatch?invoke=KEY&body=...&share=TOKEN`.",
    "5. Read the runner result.",
    "6. Return the receipt: `/api/dispatch?receipt=inv_ID`.",
    "7. Answer from the receipt.",
    "8. Use replay for repeated work; use repair for corrected work.",
    "",
    "The first missing element — object, authority, route, or receipt — is the stopping point, and it names what it requires.",
    "",
    "## 6. Receipt",
    "",
    "A receipt proves one invocation. Every receipt records:",
    "",
    "- `invocation_id`, `timestamp`, `actor`, `credential_scope`.",
    "- `object_key`, `object_version`, `input_hash`, `input_body`.",
    "- `runner`, `status`, `output_hash`, `artifact_urls`.",
    "- `error` when the invocation fails.",
    "- `ledger_url`, `confirm_url`, `replay_url`, `repair_url`.",
    "- `parent_invocation_id` when the invocation was delegated.",
    "- `repair_of_invocation_id` when the invocation is a repair.",
    "",
    "Read a receipt at `/api/dispatch?receipt=inv_ID`. Confirm one publicly at `/api/dispatch?confirm=inv_ID`. Success requires a real invocation id, a recorded request, a recorded response, and a receipt link. When the receipt reports the runner failed, the action failed, and the next move is repair.",
    "",
    "## 7. Replay and repair",
    "",
    "Replay repeats a recorded invocation: `POST /api/dispatch {replay:\"inv_ID\"}`. The replay uses the recorded object key and input, produces a new invocation id and receipt, and links the new receipt to the original.",
    "",
    "Repair creates a corrected invocation: `POST /api/dispatch {key, body, repairs:\"inv_ID\"}`. The repair references the failed receipt, produces a new invocation id and receipt, and links the corrected receipt to the failure in both directions. Repair turns failure into lineage.",
    "",
    "## 8. Conformance",
    "",
    "- **OIP-READ**: the system exposes a readable object contract.",
    "- **OIP-INVOKE**: the system exposes an invocation route for the object.",
    "- **OIP-PROVE**: the system returns a receipt for the invocation.",
    "- **OIP-REPLAY**: the system repeats the recorded invocation.",
    "- **OIP-REPAIR**: the system attaches a corrected invocation to the failed receipt.",
    "- **OIP-DELEGATE**: the system hands a scoped object credential to another model, agent, browser, queue, or service.",
    "- **OIP-LEDGER**: the system stores invocation records append-only.",
    "- **OIP-ARTIFACT**: the system returns artifact references when work creates files, images, messages, code, or documents.",
    "",
    "A conformant success response returns the object key, the invocation id, the receipt URL, the status, and the result. A conformant failure response returns the object key, the invocation id when present, the error, the missing requirement, and the repair target.",
    "",
    "The latest completed suite exposes 27 numbered production clauses at `/api/dispatch?conformance=1&format=markdown`; only an owner-authenticated request may execute a fresh state-mutating run. v0.8.1 strengthens C17 with typed intent/authority/effect/postcondition records, C18 with atomic parent-budget reservation, C19 with invocation-time ancestor validation, and C20 with authority-preserving, namespaced, stop-on-failure trails. v1.1.0 adds federation: C26 (discoverable cross-domain identity + envelopes-are-data) and C27 (audience-bound capabilities), with a dedicated cross-domain proof at `/api/dispatch?fedtest=1&format=markdown` and the envelope specification at " + link("/a/oip-message", BASE + "/a/oip-message") + ". Specification: " + link("/a/oip-spec", BASE + "/a/oip-spec") + ".",
    "",
    "## 9. OIP and MCP",
    "",
    "MCP standardizes model access to tools, prompts, and resources inside a model-client session. OIP standardizes model-operated work as an object.",
    "",
    "| axis | MCP | OIP |",
    "|--|--|--|",
    "| unit | a tool, prompt, or resource a server exposes | a work object |",
    "| transport | a session between host, client, and server | a URL and object invocation with a scoped credential |",
    "| proof | a protocol response | a ledger receipt |",
    "| repair | application-defined | a corrected invocation linked to the failed receipt |",
    "| delegation | a configured session | a scoped object credential handed to any model, agent, browser, queue, or service |",
    "",
    "MCP answers the access question. OIP answers the work question.",
    "",
    "### An MCP tool is an OIP object",
    "",
    "In this build, an MCP tool is registered as an OIP object. The MCP shelf holds " + (byKind.mcp ? byKind.mcp.reduce((n, s) => n + s.count, 0) : 10) + " MCP tools as directory objects. Example object: `MCP_context7_resolve_library_id`, runner type `mcp`, read it at " + link("/api/dispatch?key=MCP_context7_resolve_library_id&format=markdown", BASE + "/api/dispatch?key=MCP_context7_resolve_library_id&format=markdown") + ".",
    "",
    "A model operates that MCP tool by opening the OIP object URL: read `/api/dispatch?key=MCP_...&format=markdown`, then invoke `/api/dispatch?invoke=MCP_...&body=...&share=TOKEN`. The MCP call runs behind the object, and OIP records the receipt. OIP addresses an MCP tool as a link and adds the receipt, the replay path, the repair path, the scope, and the ledger entry to that tool.",
    "",
    "The relationship is containment: MCP connects a session to a server; OIP registers that server's tool as one object among its runners and makes each call provable by receipt. A model reaches the MCP tool through its OIP object URL.",
    "",
    "## Public demo",
    "",
    "`NOW` is a public demo object. Read it at " + link("/api/dispatch?key=NOW&format=markdown", BASE + "/api/dispatch?key=NOW&format=markdown") + ". Invoke it with a scoped credential to produce a receipt, confirm the receipt publicly at `/api/dispatch?confirm=inv_ID`, then replay and repair from that receipt. The demo runs the full loop with a scoped, rate-limited credential.",
    "",
    "## Terms",
    "",
    "- **Build**: the whole miscsubjects system — site, APIs, directory rows, files, ledgers, tools, models, workers, and deploy path.",
    "- **Object**: one thing the build can read or do.",
    "- **Directory row**: the saved contract for one object. It says what the object does, what inputs it takes, and how to run it.",
    "- **Dispatch**: the invocation door. It receives an object key and body, finds the row, and runs it.",
    "- **Runner**: the actual machine that does the work: HTTP, model, shell, database, file, Worker, or service.",
    "- **Ledger**: the append-only record of what was asked, what ran, and what came back.",
    "- **Receipt**: one proof object for one invocation.",
    "- **Replay**: run the same recorded invocation again.",
    "- **Repair**: run a corrected invocation and attach it to the failed receipt.",
    "- **Tap & Go**: one copied drop that carries object map, credential, execute shape, and receipt rule together.",
    "",
    "## Foundation articles",
    "",
    "OIP assumes a reader may have zero context. The root article gives the whole shape, then the foundation articles explain the words a model or human needs before operating the build:",
    "",
    "- " + link("OIP operating model", BASE + "/a/oip-operating-model") + " states the operating model, the four invariants, and the six-step operating loop.",
    "- " + link("What is an object?", BASE + "/a/oip-what-is-object") + " explains what an OIP object is and why everything in the build is one.",
    "- " + link("What is a capability?", BASE + "/a/oip-what-is-capability") + " explains scoped, expiring, revocable permissions and why least privilege matters.",
    "- " + link("What is a token?", BASE + "/a/oip-what-is-token") + " explains the credential that separates reading from acting.",
    "- " + link("What is a tenant?", BASE + "/a/oip-what-is-tenant") + " explains isolation boundaries and multi-tenant proof.",
    "- " + link("What is a voxel graph?", BASE + "/a/oip-voxel-graph") + " explains the typed node/edge machine-native topology of the build.",
    "- " + link("What is an API?", BASE + "/a/oip-api") + " explains route, method, header, body, response, proof, and repair.",
    "- " + link("What is REST?", BASE + "/a/oip-rest") + " explains resource URLs and methods such as GET, POST, PATCH, PUT, and DELETE.",
    "- " + link("How to operate the build with curl", BASE + "/a/oip-curl") + " explains terminal HTTP calls and the dispatch shape.",
    "- " + link("What is a CLI?", BASE + "/a/oip-cli") + " explains command line programs, args, cwd, output, and exit status.",
    "- " + link("Protocol lineage", BASE + "/a/oip-protocol-lineage") + " places OIP in the remote-operation protocol line: RPC, SOAP, REST, OpenAPI, MCP, W3C PROV.",
    "- " + link("What is MCP?", BASE + "/a/oip-mcp") + " explains Model Context Protocol and its place beside OIP: MCP answers the access question, OIP answers the work question.",
    "- " + link("What is GitHub?", BASE + "/a/oip-github") + " and " + link("What is GitHub MCP?", BASE + "/a/oip-github-mcp") + " explain repo/file/tool access as build objects.",
    "- " + link("OIP link structure", BASE + "/a/oip-link-structure") + " and " + link("OIP drop end to end", BASE + "/a/oip-drop-end-to-end") + " explain the self-explaining link structure that carries an object to a model.",
    "- " + link("Cron and recursive review", BASE + "/a/oip-cron-recursion") + " and " + link("Models reviewing OIP articles", BASE + "/a/oip-model-review-loop") + " explain the scheduled model-review loop.",
    "",
    "## Whole build, end to end",
    "",
    manual.what_the_build_is,
    "",
    "The end-to-end path is:",
    "",
    "1. **Caller**: some surface asks for work. The caller may be a model, browser, API client, admin page, CLI path, scheduled workflow, or messaging route.",
    "2. **Resolution**: the caller either asks `/api/dispatch?ask=<plain language>` or opens a known object.",
    "3. **Object contract**: the directory row explains the exact object: `WHAT`, `ARGS`, `EX`, `TESTS`, auth, risk, runner, and proof paths.",
    "4. **Invocation**: dispatch receives `key` and `body`, validates access, and chooses the runner.",
    "5. **Execution**: the runner does the work: HTTP, model, shell, D1, KV, R2, file, Worker, or deploy.",
    "6. **Ledger**: the build records request, response, actor, trace, cost, material output, and errors.",
    "7. **Receipt**: OIP returns a receipt link for the invocation.",
    "8. **Correction**: replay repeats the recorded call; repair creates a corrected call linked to the failed receipt.",
    "",
    "That pattern is the whole build. Different surfaces exist, but the object boundary is the same.",
    "",
    "## How to do anything",
    "",
    "The universal rule is: never guess a tool. Resolve the object, read the object, invoke the object, prove the invocation.",
    "",
    "1. **Orient**: open `/api/dispatch?orient=1&format=markdown` when cold.",
    "2. **Ask**: open `/api/dispatch?ask=<what you want>`.",
    "3. **Read**: open `/api/dispatch?key=<KEY>&format=markdown` for the exact object.",
    "4. **Invoke**: use Tap & Go, owner auth, or the returned run URL.",
    "5. **Prove**: open `/api/dispatch?receipt=inv_ID&share=TOKEN` and answer from the receipt.",
    "6. **Repair**: if wrong, call `POST /api/dispatch {key, body, repairs:\"inv_ID\"}` so the fix stays attached to the failure.",
    "",
    "If a model only knows this one path, it can operate the build without guessing.",
    "",
    "## What each part does",
    "",
    "- **Directory** is the catalog of executable objects.",
    "- **Dispatch** is the one invocation endpoint.",
    "- **Rows** are object contracts.",
    "- **Prompts** are rows too; an agent's system prompt is its row content.",
    "- **Articles** are content objects with body, claims, sources, provenance, widgets, and bundle JSON.",
    "- **Files** are operational code in the repo; bulk/reference data belongs outside the repo and is reached by API.",
    "- **Admin pages** are human work surfaces over the same objects.",
    "- **Runners** connect objects to actual work.",
    "- **Ledger and receipts** are proof and memory.",
    "- **Self-test** is the executable spec for claimed behavior.",
    "- **Deploy** moves code changes to Cloudflare Pages.",
    "",
    "## Tap & Go",
    "",
    "Tap & Go is the copy primitive for handing OIP to a model. One copy gives the model the credential, protocol, tree, search pattern, execute pattern, and receipt loop together. Do not assemble a token, a map, a bundle, and a link by hand. The copied drop is the interface.",
    "",
    "The action loop is: ask in plain language, read the object, invoke the object named by the task, open the receipt, then replay or repair from that receipt if the result is wrong. The receipt is the proof: an action is established by its receipt.",
    "",
    "## Object contract",
    "",
    "An OIP capability exposes the same fields every time: `WHAT`, `ARGS`, `EX`, `TESTS`, auth, risk, runner, run URL, machine contract, troubleshooting, invocation history, receipt, replay, and repair.",
    "",
    "The same object is readable in three forms:",
    "",
    "1. A human article: `/a/oip-capability-KEY`.",
    "2. A machine document: `/api/dispatch?key=KEY&format=markdown`.",
    "3. A JSON object: `/api/dispatch?key=KEY`.",
    "",
    "The human article, the machine document, and the JSON object are three views of one object.",
    "",
    "## Proof",
    "",
    "OIP treats the receipt as success. A completed action has a real invocation id, a recorded request, a recorded response, and a receipt link. When the receipt reports the runner failed, the action failed, and the next move is repair.",
    "",
    "## Machine-native JSON",
    "",
    "The JSON bundle for this article is part of the article. It gives a model the same object map in structured form: how to orient, ask, read, invoke, prove, repair, traverse shelves, and understand the build facets. The prose is for human orientation; the JSON is for execution.",
    "",
    "The root tree is live at " + link("/api/dispatch?map=1&format=markdown", BASE + "/api/dispatch?map=1&format=markdown") + ". The machine bundle for this article is " + link("/api/articles/oip/bundle?format=markdown", BASE + "/api/articles/oip/bundle?format=markdown") + ". Those are handles, not the product path; Tap & Go is the product path.",
    "",
    "## OIP article library",
    "",
    "These articles explain the build the way a strong article system explains any subject: one subject per page, human-readable prose, machine-native bundle, sources, claims, and proof paths.",
    "",
    ...OIP_PRIMER_ARTICLES.map((a) => "- " + link(a.title, BASE + "/a/" + a.slug)),
    "",
    "## Shelves",
    "",
  ];
  for (const kind of ["api", "cli", "mcp", "device", "model", "core"]) {
    const arr = byKind[kind] || [];
    const slug = shelfSlugForKind(kind);
    const total = arr.reduce((n, s) => n + s.count, 0);
    lines.push("### " + (KIND_LABEL[slug] || slug));
    lines.push(total + " capabilities across " + arr.length + " system" + (arr.length === 1 ? "" : "s") + ". " + link("Open shelf", BASE + "/a/" + kindSlug(slug)) + ".");
    lines.push("");
  }
  lines.push("## Owner/admin invocation");
  lines.push("");
  lines.push("Owner auth and scoped capability URLs are both invocation credentials. The difference is scope: owner auth can mint broad drops; a row token can fire one named object. In both cases the result is the same OIP loop: exact object, exact call, exact receipt.");
  lines.push("");
  lines.push("## The source philosophy");
  lines.push("");
  lines.push("This protocol is the running implementation of a written structure: THE TOTAL STRUCTURE — Grand Unified Protocol, v3.0. The structure specified the build; the build returned two primitives the structure lacked — the receipt and the recursion — and both were absorbed as axioms (A11, A12). The full text lives on this shelf, verbatim, as traversable voxels, under the same review recursion, the same append-only versioning, and the same falsification surfaces as every object here.");
  lines.push("");
  lines.push("- Root, human: " + link("/a/oip-total-structure", BASE + "/a/oip-total-structure"));
  lines.push("- Root, machine: `GET /api/articles/oip-total-structure` (JSON with `shelf.next` traversal) · `GET /api/articles/oip-total-structure/shelf` (whole reading order, one object) · `GET /api/articles/oip-total-structure/bundle?format=markdown`");
  lines.push("- Voxel graph with the philosophy plane wired to the protocol plane: `GET /api/articles/oip/voxels` — nodes typed `philosophy` link each book to the mechanism implementing it (Ground → the directory floor; Obligation → capability tokens; Terrain → receipts and the governor; the Amendment Protocol → this very version table).");
  lines.push("- Walk order: Ground → Obligation → Terrain → Method → Machine Plane → Object Grammar → Designer → Beyond Incentive → Amendment Protocol → Falsification. A model traverses the entire corpus by following `shelf.next` from any entry point until null.");
  lines.push("");
  lines.push("The identity claim of Book VII holds here operationally: the system is the externalized ought of its designer — an identity, not a representation. The philosophy governs the build; the build receipts the philosophy.");
  lines.push("");
  lines.push("**The abstraction relation:** MCP is tool/session access. OIP is accountable work-object execution above and around tools, including MCP tools. **The verbatim law:** philosophy voxels are prose-preserving — recursion prosecutes them, it does not rewrite them unless the owner accepts an amendment. **The drop:** hand any model " + link("/api/articles/oip-total-structure/drop", BASE + "/api/articles/oip-total-structure/drop") + " and it can read, traverse, attack, and post objections without a human in the loop.");
  return lines.join("\n");
}

function kindBody(kind, map) {
  const label = KIND_LABEL[kind] || kind;
  const lines = [
    "## " + label,
    "",
    "This is an OIP shelf article. It groups one kind of build machinery so a reader can move from a broad class of work to the exact system article and then to a leaf capability.",
    "",
    "Use this shelf when the task is still broad: API work, CLI work, MCP work, device work, model work, or core build work. The next move is to open the system whose name matches the work, then open the capability leaf whose `WHAT` and `ARGS` match the request.",
    "",
    "Machine handle: " + link("/api/dispatch?map=" + kind + "&format=markdown", BASE + "/api/dispatch?map=" + kind + "&format=markdown") + ". Root article: " + link("/a/oip", BASE + "/a/oip") + ".",
    "",
    "## Systems",
    "",
  ];
  for (const s of map.shelves || []) {
    lines.push("### " + s.label);
    lines.push(s.count + " capabilities. Open the system article at " + link("/a/" + systemSlug(s.system), BASE + "/a/" + systemSlug(s.system)) + "; the machine system map is " + link("?map=" + s.system + "&format=markdown", s.open) + ".");
    lines.push("");
  }
  return lines.join("\n");
}

function systemBody(map) {
  const lines = [
    "## " + map.label,
    "",
    map.is || "Generated OIP system article.",
    "",
    "This page is the operating article for one build subsystem. It is generated from live directory rows. If a task belongs to this subsystem, scan the operations below, open the matching capability article, run only the exact object named there, and verify by receipt.",
    "",
    "Kind: `" + map.kind_of + "`. Capabilities: `" + map.count + "`. Machine system map: " + link("/api/dispatch?map=" + map.system + "&format=markdown", BASE + "/api/dispatch?map=" + map.system + "&format=markdown") + ". Root: " + link("/a/oip", BASE + "/a/oip") + ".",
    "",
    "## Operations",
    "",
  ];
  for (const o of map.operations || []) {
    lines.push("### " + o.key);
    lines.push(o.what || "Invokable OIP capability.");
    if (o.when_to_use) lines.push("Use when: " + o.when_to_use);
    if (o.args) lines.push("Arguments: `" + o.args + "`.");
    lines.push("Human article: " + link("/a/" + capabilitySlug(o.key), BASE + "/a/" + capabilitySlug(o.key)) + ". Machine doc: " + link("?key=" + o.key + "&format=markdown", o.doc) + ". Invocation history: " + link("/api/invocations?object_id=" + o.key, o.history) + ".");
    lines.push("");
  }
  return lines.join("\n");
}

function capabilityBody(self) {
  const lines = [
    "## " + self.name,
    "",
    "This is one executable OIP object. It is the leaf where prose stops and exact invocation begins.",
    "",
    self.what || "Invokable OIP capability.",
    "",
    "Parent system: " + link(self.article?.system || "system", self.article?.parent_system || BASE + "/api/dispatch?map=1&format=markdown") + ". Root: " + link("/a/oip", BASE + "/a/oip") + ". Machine doc: " + link("/api/dispatch?key=" + self.name + "&format=markdown", BASE + "/api/dispatch?key=" + encodeURIComponent(self.name) + "&format=markdown") + ". Invocation history: " + link("/api/invocations?object_id=" + self.name, BASE + "/api/invocations?object_id=" + encodeURIComponent(self.name)) + ".",
    "",
    "## Invoke",
    "",
    "Example: `" + (self.example || "") + "`",
    "",
    "Run URL: `" + (self.run_now || "") + "`",
    "",
    "Auth: `" + self.auth + "`. Risk: `" + self.risk + "`.",
    "",
    "## Machine contract",
    "",
    ...(self.machine_contract || []).map((x) => "- " + x),
    "",
    "## Troubleshooting",
    "",
    ...(self.troubleshooting || []).map((t) => "- **" + t.problem + "** - " + t.action),
    "",
    "## Receipt loop",
    "",
    "After any action, open the receipt. If it is wrong, repair it with `POST /api/dispatch {key, body, repairs:\"inv_ID\"}`. If you need to repeat the exact recorded call, replay it with `POST /api/dispatch {replay:\"inv_ID\"}`.",
    "",
    "## Full generated capability doc",
    "",
    objectSelfMarkdown(self),
  ];
  return lines.join("\n");
}

export async function listOipArticleSummaries(env, slim = true) {
  let root = { shelves: [] };
  if (!slim) {
    try {
      const dir = await loadDirectoryRows(env);
      root = buildCapabilityMap(dir, "", "");
    } catch (e) {
      console.error("oip_summary_capability_map_error", e?.message || e);
    }
  }
  const out = [
    {
      slug: "oip",
      title: "Object Invocation Protocol",
      updated_at: nowIso(),
      status: "published",
      url: "/a/oip",
      bundle: "/api/articles/oip/bundle?format=markdown",
    },
  ];
  for (const a of OIP_PRIMER_ARTICLES) {
    out.push({
      slug: a.slug,
      title: a.title,
      updated_at: nowIso(),
      status: "published",
      url: "/a/" + a.slug,
      bundle: "/api/articles/" + a.slug + "/bundle?format=markdown",
    });
  }
  const seen = new Set(out.map((x) => x.slug));
  for (const d of await listDynamicOipArticles(env)) {
    if (seen.has(d.slug)) continue;
    seen.add(d.slug);
    out.push({
      slug: d.slug,
      title: d.title,
      updated_at: d.created_at || nowIso(),
      status: "published",
      url: "/a/" + d.slug,
      bundle: "/api/articles/" + d.slug + "/bundle?format=markdown",
      author_model: d.author_model || null,
      version: d.version || 1,
    });
  }
  for (const kind of ["apis", "clis", "mcps", "devices", "models", "core"]) {
    out.push({
      slug: kindSlug(kind),
      title: "OIP " + (KIND_LABEL[kind] || kind),
      updated_at: nowIso(),
      status: "published",
      url: "/a/" + kindSlug(kind),
      bundle: "/api/articles/" + kindSlug(kind) + "/bundle?format=markdown",
    });
  }
  if (!slim) {
    for (const s of root.shelves || []) {
      out.push({
        slug: systemSlug(s.system),
        title: "OIP system: " + s.label,
        updated_at: nowIso(),
        status: "published",
        url: "/a/" + systemSlug(s.system),
        bundle: "/api/articles/" + systemSlug(s.system) + "/bundle?format=markdown",
      });
    }
  }
  return out;
}

/** Live clarity-review section appended to article bodies so scores and gaps are visible on the page. */
async function reviewBodySection(env, slug) {
  const h = await recentOipReviewHistory(env, slug, 3);
  if (!h || !h.count) return "";
  const lines = [
    "",
    "## Latest clarity reviews (live)",
    "",
    "Fresh models are sent this article's bundle and asked two separate questions: how clear is the machine JSON, and how clear is the English body. Scores are 0 to 10. The full history is in the append-only ledger.",
    "",
  ];
  for (const r of h.reviews) {
    const sc = r.scores || {};
    lines.push(
      "- " + String(r.ts || "").slice(0, 16).replace("T", " ") +
      " · model `" + (r.model || "?") + "` · " + (r.pass ? "PASS" : "NEEDS WORK") +
      " · JSON " + (sc.json_clarity ?? "?") + "/10 · English " + (sc.english_clarity ?? "?") +
      "/10 · zero-context human " + (sc.zero_context_human ?? "?") + "/10",
    );
    const mc = (r.missing_concepts || [])
      .map((x) => (typeof x === "string" ? x : x?.slug || x?.title || ""))
      .filter(Boolean)
      .slice(0, 4);
    if (mc.length) lines.push("  - gaps named: " + mc.join("; "));
  }
  lines.push("");
  lines.push("How the loop self-corrects: a failing review queues a model revision of this article (a new append-only version). A missing concept named by a reviewer queues a brand-new machine-written article, which then enters the same review cycle.");
  return lines.join("\n");
}

export async function buildOipArticle(env, slug) {
  const parsed = parseOipArticleSlug(slug);
  if (!parsed) return null;
  const dir = await loadDirectoryRows(env);
  if (parsed.type === "root") {
    const map = buildCapabilityMap(dir, "", "");
    const reviews = await reviewBodySection(env, "oip");
    return articleRow("oip", "Object Invocation Protocol", rootBody(map) + reviews, "root", {
      total: map.total,
      systems: map.systems,
      metric: "capabilities",
    });
  }
  if (parsed.type === "primer") {
    const a = OIP_PRIMER_BY_SLUG.get(parsed.slug);
    if (!a) return null;
    const dyn = await loadDynamicOipArticle(env, parsed.slug);
    const reviews = await reviewBodySection(env, parsed.slug);
    if (dyn) {
      return articleRow(dyn.slug, dyn.title || a.title, dyn.body + reviews, "primer", {
        count: dyn.version,
        metric: "revision",
        primer: parsed.slug,
        version: dyn.version,
        author_model: dyn.author_model,
        revision_source: dyn.source,
      });
    }
    return articleRow(a.slug, a.title, ((await loadPrimerBody(env, parsed.slug)) || "") + reviews, "primer", {
      count: 1,
      metric: "OIP primer",
      primer: a.slug,
    });
  }
  if (parsed.type === "dynamic") {
    const dyn = await loadDynamicOipArticle(env, parsed.slug);
    if (!dyn) return null;
    const reviews = await reviewBodySection(env, parsed.slug);
    const article = articleRow(dyn.slug, dyn.title, dyn.body + reviews, "dynamic", {
      count: dyn.version,
      metric: "version",
      version: dyn.version,
      author_model: dyn.author_model,
      revision_source: dyn.source,
    });
    // Merge articles table meta if present (Normandy repair path)
    try {
      const articlesRow = await env.DB.prepare('SELECT meta FROM articles WHERE slug=?').bind(parsed.slug).first();
      if (articlesRow && articlesRow.meta) {
        const articlesMeta = JSON.parse(articlesRow.meta);
        if (articlesMeta.claims && articlesMeta.claims.length > 0) {
          const meta = JSON.parse(article.meta);
          meta.claims = articlesMeta.claims;
          meta.sources = articlesMeta.sources || [];
          meta.extra = { ...meta.extra, ...articlesMeta.extra };
          meta.has_traversal = articlesMeta.has_traversal || false;
          article.meta = JSON.stringify(meta);
        }
      }
    } catch (e) {
      console.error("oip_article_meta_merge_error", parsed.slug, e?.message || e);
    }
    return article;
  }
  if (parsed.type === "kind") {
    const map = buildCapabilityMap(dir, "", parsed.kind);
    if (map.error) return null;
    return articleRow(kindSlug(parsed.kind), "OIP " + (KIND_LABEL[parsed.kind] || parsed.kind), kindBody(parsed.kind, map), "kind", {
      count: map.count,
      systems: map.systems,
      metric: "capabilities",
    });
  }
  if (parsed.type === "system") {
    const map = buildCapabilityMap(dir, "", parsed.system);
    if (map.error) return null;
    return articleRow(systemSlug(map.system), "OIP system: " + map.label, systemBody(map), "system", {
      count: map.count,
      system: map.system,
      metric: "capabilities",
    });
  }
  if (parsed.type === "capability") {
    const row = dir[parsed.key];
    if (!row) return null;
    const self = buildObjectSelf(row, parsed.key, {});
    return articleRow(capabilitySlug(parsed.key), "OIP capability: " + parsed.key, capabilityBody(self), "capability", {
      count: 1,
      key: parsed.key,
      metric: "capability",
    });
  }
  return null;
}

function bundleUrls(slug) {
  return {
    human_page: BASE + "/a/" + slug,
    bundle: BASE + "/api/articles/" + slug + "/bundle",
    bundle_markdown: BASE + "/api/articles/" + slug + "/bundle?format=markdown",
    oip_root: BASE + "/a/oip",
    oip_tree_markdown: BASE + "/api/dispatch?map=1&format=markdown",
    oip_tree_json: BASE + "/api/dispatch?map=1",
    content_system_map: BASE + "/api/articles/system-map?format=markdown",
    mint_capability: BASE + "/api/dispatch?mint_share=1&scope=row&key=KEY&ttl=600&uses=1",
    explain_token: BASE + "/api/dispatch?explain=1&share=TOKEN",
    receipt: BASE + "/api/dispatch?receipt=inv_ID&share=TOKEN",
  };
}

export async function recentOipReviewHistory(env, slug, limit = 8) {
  if (!env?.LEDGER) return { count: 0, reviews: [], note: "LEDGER binding missing" };
  const s = String(slug || "oip").replace(/"/g, "");
  const lim = Math.min(Math.max(Number(limit) || 8, 1), 25);
  try {
    const rows = (await env.LEDGER.prepare(
      "SELECT id, ts, actor, status, trace_id, request_json, request_preview, response_json, response_preview " +
      "FROM events WHERE key='OIP_ARTICLE_REVIEW' AND (request_preview LIKE ? OR request_json LIKE ?) " +
      "ORDER BY ts DESC LIMIT ?",
    ).bind('%"slug":"' + s + '"%', '%"slug":"' + s + '"%', lim).all()).results || [];
    const reviews = rows.map((r) => {
      let req = null;
      let res = null;
      try { req = JSON.parse(r.request_json || r.request_preview || "{}"); }
      catch (e) { console.error("oip_review_request_json_error", r.id, e?.message || e); }
      try { res = JSON.parse(r.response_json || r.response_preview || "{}"); }
      catch (e) { console.error("oip_review_response_json_error", r.id, e?.message || e); }
      const review = res?.review || res || {};
      return {
        event_id: r.id,
        ts: r.ts,
        model: r.actor || req?.model || review.model || null,
        trace_id: r.trace_id || null,
        status: r.status,
        scores: review.scores || review.clarity || null,
        pass: review.pass ?? null,
        missing_concepts: review.missing_concepts || review.subsidiary_articles || [],
        concrete_fixes: review.concrete_fixes || review.fixes || [],
      };
    });
    return {
      count: reviews.length,
      reviews,
      ledger_filter: BASE + "/admin/ledger?service=oip-review&key=OIP_ARTICLE_REVIEW",
    };
  } catch (e) {
    return { count: 0, reviews: [], error: String(e?.message || e) };
  }
}

async function oipArticleVersionHistory(env, slug, limit = 12) {
  if (!env?.DB) return [];
  const s = String(slug || "").trim();
  const lim = Math.min(Math.max(Number(limit) || 12, 1), 50);
  try {
    const rows = (await env.DB.prepare(
      "SELECT slug, version, title, author_model, source, review_event_id, created_at " +
      "FROM oip_articles WHERE slug=? ORDER BY version DESC LIMIT ?",
    ).bind(s, lim).all()).results || [];
    return rows.map((r) => ({
      slug: r.slug,
      version: r.version,
      title: r.title,
      author_model: r.author_model || null,
      source: r.source || null,
      review_event_id: r.review_event_id || null,
      created_at: r.created_at || null,
    }));
  } catch {
    return [];
  }
}

/**
 * The OIP voxel graph — the protocol as a typed node/edge structure a machine
 * can traverse without reading any prose. Nodes are the real moving parts;
 * edges are the real relations; every node that has a URL carries it.
 */
// THE TOTAL STRUCTURE shelf — the source philosophy as first-class, machine-traversable
// voxels. Order is reading order; every entry resolves to /a/<slug> (human),
// /api/articles/<slug> (JSON), and /api/articles/<slug>/bundle (machine bundle).
export const TOTAL_STRUCTURE_SHELF = [
  { slug: 'oip-total-structure',    book: 'ROOT',      title: 'THE TOTAL STRUCTURE — Grand Unified Protocol' },
  { slug: 'oip-ground',             book: 'BOOK I',    title: 'Ground — the twelve axioms and the moral floor' },
  { slug: 'oip-obligation',         book: 'BOOK II',   title: 'Obligation — capability creates debt' },
  { slug: 'oip-terrain',            book: 'BOOK III',  title: 'Terrain — the four states and the decay clock' },
  { slug: 'oip-method',             book: 'BOOK IV',   title: 'Method — trace, install, and prove the invariant' },
  { slug: 'oip-machine-plane',      book: 'BOOK V',    title: 'The Machine Plane — receipts, surety, the command plane' },
  { slug: 'oip-object-grammar',     book: 'BOOK VI',   title: 'The Object Grammar — the doctrine the build proved' },
  { slug: 'oip-the-designer',       book: 'BOOK VII',  title: 'The Designer — maker-system identity' },
  { slug: 'oip-beyond-incentive',   book: 'BOOK VIII', title: 'Beyond Incentive — the wall and the guardian' },
  { slug: 'oip-amendment-protocol', book: 'BOOK IX',   title: 'The Amendment Protocol — self-revision, chained' },
  { slug: 'oip-falsification',      book: 'BOOK X',    title: 'Falsification — eight surfaces, attack protocol, appendices' },
];

// Machine traversal record for one shelf slug: prev/next/root plus every queryable route.
export function shelfFor(slug) {
  const i = TOTAL_STRUCTURE_SHELF.findIndex((s) => s.slug === slug);
  if (i === -1) return null;
  const at = (j) => TOTAL_STRUCTURE_SHELF[j]
    ? { slug: TOTAL_STRUCTURE_SHELF[j].slug, book: TOTAL_STRUCTURE_SHELF[j].book, title: TOTAL_STRUCTURE_SHELF[j].title,
        human: '/a/' + TOTAL_STRUCTURE_SHELF[j].slug, json: '/api/articles/' + TOTAL_STRUCTURE_SHELF[j].slug,
        bundle: '/api/articles/' + TOTAL_STRUCTURE_SHELF[j].slug + '/bundle?format=markdown' }
    : null;
  return {
    kind: 'total_structure_shelf',
    reads_as: 'The OIP source philosophy, machine-traversable. Walk next until null; every stop has human, json, and bundle routes; voxel graph at /api/articles/oip/voxels.',
    position: i + 1,
    of: TOTAL_STRUCTURE_SHELF.length,
    this: at(i),
    prev: i > 0 ? at(i - 1) : null,
    next: i < TOTAL_STRUCTURE_SHELF.length - 1 ? at(i + 1) : null,
    root: at(0),
    all: TOTAL_STRUCTURE_SHELF.map((s, j) => ({ order: j + 1, ...at(j) })),
  };
}

export function buildOipVoxelGraph(rootMap) {
  const N = (id, kind, label, url, extra = {}) => ({ id, kind, label, url: url || null, ...extra });
  const E = (from, rel, to) => ({ from, rel, to });
  const nodes = [
    // actors + planes
    N("caller", "actor", "Caller (human, model, cron, webhook)", null),
    N("dispatch", "endpoint", "Dispatch — the one invocation door", BASE + "/api/dispatch"),
    N("directory", "table", "Directory — the executable object catalog", BASE + "/api/dispatch?map=1", { count: rootMap?.total || null }),
    N("runner_fn", "runner", "fn — edge functions", null),
    N("runner_http", "runner", "http — outbound HTTP targets", null),
    N("runner_mac", "runner", "mac — local machine bridge", null),
    N("runner_model", "runner", "model — LLM calls", null),
    N("runner_agent", "runner", "agent — spawned coding agents", null),
    // proof plane
    N("events", "table", "Events ledger (append-only)", BASE + "/api/invocations"),
    N("invocations", "table", "Invocations ledger (append-only)", BASE + "/api/invocations"),
    N("receipt", "verb", "receipt — full forensic proof of one call", BASE + "/api/dispatch?receipt=inv_ID"),
    N("confirm", "verb", "confirm — public one-line proof", BASE + "/api/dispatch?confirm=inv_ID"),
    N("replay", "verb", "replay — re-run a recorded call", null),
    N("repair", "verb", "repair — corrected call linked to the failure", null),
    // access plane
    N("capability", "layer", "Capability — scoped, expiring, revocable token", BASE + "/api/dispatch?explain=1&share=TOKEN"),
    N("tenant", "layer", "Tenant — isolation boundary over capabilities", BASE + "/api/dispatch?tenancy=1"),
    // discovery plane
    N("ask", "verb", "ask — plain words to runnable call", BASE + "/api/dispatch?ask=..."),
    N("orient", "verb", "orient — one read, full familiarization", BASE + "/api/dispatch?orient=1&format=markdown"),
    N("conformance", "verb", "conformance — live protocol proof", BASE + "/api/dispatch?conformance=1&format=markdown"),
    // documentation plane
    N("article_human", "surface", "Human article (/a/<slug>)", BASE + "/a/oip"),
    N("article_machine", "surface", "Machine bundle (JSON)", BASE + "/api/articles/oip/bundle"),
    N("review_loop", "loop", "Clarity recursion — models score, revise, and write articles", BASE + "/a/oip-model-review-loop"),
    N("oip_articles_table", "table", "oip_articles — append-only machine-written versions", null),
    N("governor", "loop", "Governor — deterministic digests, recurrence memory, briefs on change", BASE + "/api/dispatch?ask=governor"),
    // philosophy plane — THE TOTAL STRUCTURE, the protocol's source philosophy (full text, verbatim)
    ...TOTAL_STRUCTURE_SHELF.map((s) =>
      N("ts_" + s.slug.replace(/^oip-/, "").replace(/-/g, "_"), "philosophy", s.book + " — " + s.title, BASE + "/api/articles/" + s.slug,
        { human: BASE + "/a/" + s.slug, bundle: BASE + "/api/articles/" + s.slug + "/bundle?format=markdown" })),
    // convergence pattern nodes
    N("pattern_branching", "pattern", "Pattern 1: Branching — The Routing Solution", BASE + "/a/oip-convergence-pattern-branching",
      { human: BASE + "/a/oip-convergence-pattern-branching", bundle: BASE + "/api/articles/oip-convergence-pattern-branching/bundle?format=markdown" }),
    N("pattern_bounded_chaos", "pattern", "Pattern 6: Bounded Chaos — The Aliveness Solution (Keystone)", BASE + "/a/oip-convergence-pattern-bounded-chaos",
      { human: BASE + "/a/oip-convergence-pattern-bounded-chaos", bundle: BASE + "/api/articles/oip-convergence-pattern-bounded-chaos/bundle?format=markdown" }),
    // school nodes
    N("school_physics", "school", "The Physicists — Schrodinger, Prigogine, England, Noether, Feynman, et al.", BASE + "/a/oip-schools-physics",
      { human: BASE + "/a/oip-schools-physics", bundle: BASE + "/api/articles/oip-schools-physics/bundle?format=markdown" }),
    N("school_philosophy_west", "school", "Western Philosophers — Heraclitus, Spinoza, Whitehead", BASE + "/a/oip-schools-philosophy-west",
      { human: BASE + "/a/oip-schools-philosophy-west", bundle: BASE + "/api/articles/oip-schools-philosophy-west/bundle?format=markdown" }),
    N("school_philosophy_east", "school", "Eastern Philosophers — Laozi, Zhuangzi, Buddhism, Advaita Vedanta", BASE + "/a/oip-schools-philosophy-east",
      { human: BASE + "/a/oip-schools-philosophy-east", bundle: BASE + "/api/articles/oip-schools-philosophy-east/bundle?format=markdown" }),
  ];
  const edges = [
    E("caller", "invokes", "dispatch"),
    E("dispatch", "resolves_in", "directory"),
    E("directory", "routes_to", "runner_fn"),
    E("directory", "routes_to", "runner_http"),
    E("directory", "routes_to", "runner_mac"),
    E("directory", "routes_to", "runner_model"),
    E("directory", "routes_to", "runner_agent"),
    E("dispatch", "records_in", "events"),
    E("dispatch", "records_in", "invocations"),
    E("receipt", "proves", "invocations"),
    E("confirm", "proves", "invocations"),
    E("replay", "re_runs", "invocations"),
    E("repair", "annotates", "invocations"),
    E("capability", "scopes", "dispatch"),
    E("tenant", "scopes", "capability"),
    E("ask", "discovers_in", "directory"),
    E("orient", "summarizes", "directory"),
    E("conformance", "verifies", "dispatch"),
    E("article_human", "presents", "article_machine"),
    E("article_machine", "documents", "directory"),
    E("review_loop", "scores", "article_human"),
    E("review_loop", "scores", "article_machine"),
    E("review_loop", "writes_versions_to", "oip_articles_table"),
    E("oip_articles_table", "serves", "article_human"),
    // philosophy plane edges: the structure specifies the build; the build receipts the structure.
    E("ts_total_structure", "specifies", "dispatch"),
    E("ts_ground", "installs_floor_for", "directory"),
    E("ts_obligation", "compiles_to", "capability"),
    E("ts_terrain", "diagnoses_capture_via", "receipt"),
    E("ts_terrain", "runs_checking_network_as", "governor"),
    E("ts_method", "accepts_installations_via", "conformance"),
    E("ts_machine_plane", "prices", "invocations"),
    E("ts_object_grammar", "generalizes", "dispatch"),
    E("ts_object_grammar", "mandates_lineage_in", "repair"),
    E("ts_the_designer", "externalizes_ought_as", "directory"),
    E("ts_beyond_incentive", "guards", "ts_total_structure"),
    E("ts_amendment_protocol", "governs_versions_in", "oip_articles_table"),
    E("ts_falsification", "prosecutes", "ts_total_structure"),
    E("review_loop", "prosecutes", "ts_total_structure"),
    // convergence pattern edges
    E("pattern_branching", "implements", "directory"),
    E("pattern_branching", "manifests_in", "runner_fn"),
    E("pattern_bounded_chaos", "enables", "runner_model"),
    E("pattern_bounded_chaos", "keystone_of", "review_loop"),
    E("pattern_bounded_chaos", "governs", "dispatch"),
    // school edges
    E("school_physics", "converges_on", "pattern_branching"),
    E("school_physics", "converges_on", "pattern_bounded_chaos"),
    E("school_philosophy_west", "describes", "ts_ground"),
    E("school_philosophy_west", "converges_with", "school_philosophy_east"),
    E("school_philosophy_east", "describes", "ts_the_designer"),
    E("school_philosophy_east", "converges_with", "school_philosophy_west"),
    ...TOTAL_STRUCTURE_SHELF.slice(1).map((s) =>
      E("ts_total_structure", "contains", "ts_" + s.slug.replace(/^oip-/, "").replace(/-/g, "_"))),
    ...TOTAL_STRUCTURE_SHELF.slice(0, -1).map((s, i) =>
      E("ts_" + s.slug.replace(/^oip-/, "").replace(/-/g, "_"), "reads_next",
        "ts_" + TOTAL_STRUCTURE_SHELF[i + 1].slug.replace(/^oip-/, "").replace(/-/g, "_"))),
  ];
  const adjacency = {};
  for (const e of edges) {
    (adjacency[e.from] = adjacency[e.from] || []).push(e.rel + " -> " + e.to);
  }
  return {
    kind: "oip_voxel_graph",
    reads_as: "Traverse from caller. Every edge label is the literal relation. Every node with a url is live.",
    counts: { nodes: nodes.length, edges: edges.length },
    machine_reading_order: ["caller", "dispatch", "directory", "capability", "receipt", "repair", "review_loop", "conformance", "ts_total_structure", "ts_ground", "ts_obligation", "ts_terrain", "ts_method", "ts_machine_plane", "ts_object_grammar", "ts_the_designer", "ts_beyond_incentive", "ts_amendment_protocol", "ts_falsification"],
    nodes,
    edges,
    adjacency,
  };
}

export async function buildOipArticleBundle(env, slug, opts = {}) {
  const article = await buildOipArticle(env, slug);
  if (!article) return buildCorpusArticleBundle(env, slug);
  const parsed = parseOipArticleSlug(article.slug);
  const meta = JSON.parse(article.meta || "{}");
  const dir = await loadDirectoryRows(env);
  const root = buildCapabilityMap(dir, "", "");
  const manual = buildFacetManual(root);
  const reviewHistory = await recentOipReviewHistory(env, article.slug, opts.review_limit || 8);
  const versionHistory = await oipArticleVersionHistory(env, article.slug, opts.version_limit || 12);
  const shelf = shelfFor(article.slug);
  const machine = {
    protocol: "OIP article bundle",
    version: "0.5",
    generated_from: "live directory rows",
    slug: article.slug,
    type: parsed?.type || "unknown",
    urls: bundleUrls(article.slug),
    traversal: "/a/oip -> /a/oip-apis -> /a/oip-system-github -> /a/oip-capability-github-list-issues -> ?receipt=inv_ID",
    // Total Structure voxels: full corpus traversal in-bundle, so a zero-context reader
    // sees the whole shelf (prev/next/root/all) instead of dangling cross-references.
    ...(shelf ? { shelf } : {}),
    counts: { capabilities: root.total, systems: root.systems },
    action_boundary: "Docs are public. Actions require scoped capability tokens or owner auth.",
    append_only_payload: {
      kind: "oip_article_payload",
      article_slug: article.slug,
      body_format: "human-readable markdown article",
      machine_format: "JSON object in this bundle.machine",
      version_table: "oip_articles",
      version_history: versionHistory,
      generated_articles: versionHistory.length
        ? "latest row wins; prior rows remain stored"
        : "static/generated article; review and invocation ledgers still append-only",
      review_ledger_key: "OIP_ARTICLE_REVIEW",
      intake_ledger_key: "MODEL_CHAT_INTAKE",
      editorial_ledger_key: "EDITORIAL_BOARD_DECISION",
      proof: "A content change is proven by a new oip_articles version or by a ledger event that queued review/revision.",
    },
    oip_article_library: [
      ...OIP_PRIMER_ARTICLES.map((a) => ({
        slug: a.slug,
        title: a.title,
        human_page: BASE + "/a/" + a.slug,
        bundle_markdown: BASE + "/api/articles/" + a.slug + "/bundle?format=markdown",
        machine_schema: a.machine_schema ? cleanMachineSchema(a.machine_schema) : null,
      })),
      ...(await listDynamicOipArticles(env)).map((d) => ({
        slug: d.slug,
        title: d.title,
        human_page: BASE + "/a/" + d.slug,
        bundle_markdown: BASE + "/api/articles/" + d.slug + "/bundle?format=markdown",
        author_model: d.author_model || null,
        version: d.version || 1,
        machine_written: true,
      })),
    ],
    zero_context_manual: manual,
    how_to_do_anything: manual.how_to_do_any_possible_thing,
    build_self: buildSelfModel({ forHandoff: true }),
    machine_native_contract: {
      read_article: BASE + "/a/" + article.slug,
      read_bundle_markdown: BASE + "/api/articles/" + article.slug + "/bundle?format=markdown",
      find_capability_from_plain_language: BASE + "/api/dispatch?ask=<what you want>",
      read_capability: BASE + "/api/dispatch?key=<KEY>&format=markdown",
      invoke_capability: BASE + "/api/dispatch?invoke=<KEY>&body=<ARGS>&share=<TOKEN>",
      verify_receipt: BASE + "/api/dispatch?receipt=inv_ID&share=<TOKEN>",
      repair_receipt: "POST " + BASE + "/api/dispatch {key, body, repairs:'inv_ID'}",
    },
    recursive_review_loop: {
      purpose: "Cron sends OIP article bundles to fresh models and asks them to score machine JSON clarity and human English clarity separately.",
      cron_gate_kv: "oip_review_autorun=1",
      task_role: "oip-review",
      seed_endpoint: "POST " + BASE + "/api/protocol/oip-seed {slugs?, models?}",
      run_endpoint: "POST " + BASE + "/api/protocol/run?role=oip-review",
      review_endpoint: "POST " + BASE + "/api/protocol/oip-review {slug, model}",
      write_endpoint: "POST " + BASE + "/api/protocol/oip-write {slug, title?, why?, model?}",
      revise_endpoint: "POST " + BASE + "/api/protocol/oip-revise {slug, model?}",
      self_correction: "A failing review queues oip-revise (new append-only article version). A subsidiary concept named by a reviewer that has no article queues oip-write (a model writes it, then it enters the review cycle).",
      ledger_key: "OIP_ARTICLE_REVIEW",
      review_questions: OIP_REVIEW_QUESTIONS,
      articles_in_cycle: oipReviewArticleSlugs().map((s) => ({
        slug: s,
        human_page: BASE + "/a/" + s,
        bundle_markdown: BASE + "/api/articles/" + s + "/bundle?format=markdown",
      })),
      recent_reviews: reviewHistory,
    },
  };
  return attachSelf({
    bundle_version: 1,
    generated_at: nowIso(),
    transport: "Open every URL in this bundle with your browser or web / URL-fetch tool. Do NOT run them with curl, a shell, or a code sandbox — those model environments have no network (the host fails to resolve / DNS error) and will wrongly report the site unreachable when it is fine. Opening the link IS the call.",
    slug: article.slug,
    title: article.title,
    url: BASE + "/a/" + article.slug,
    register: "oip_protocol",
    tags: meta.tags || [],
    posted_at: article.created_at,
    updated_at: article.updated_at,
    body: article.body || "",
    claims: meta.claims || [],
    sources: meta.sources || [],
    voxels: buildOipVoxelGraph(root),
    provenance: meta.provenance || [],
    contributions: [],
    versions: versionHistory,
    append_only_ledger: {
      oip_articles_table: {
        append_only: true,
        latest_serves_page: true,
        history: versionHistory,
      },
      review_events: reviewHistory,
      ledger_filters: {
        article_reviews: BASE + "/admin/ledger?service=oip-review&key=OIP_ARTICLE_REVIEW&q=" + encodeURIComponent(article.slug),
        model_chat_intake: BASE + "/admin/ledger?key=MODEL_CHAT_INTAKE",
        editorial_board: BASE + "/admin/ledger?key=EDITORIAL_BOARD_DECISION",
      },
    },
    oip_review_history: reviewHistory,
    topology: null,
    question_graph: { questions: [], evidence: [], note: "OIP docs grow from model behavior, receipts, and state entries." },
    verification: { provenance: { valid: true, entries: 1, head: "virtual-oip" }, sources: { valid: true, entries: (meta.sources || []).length, head: "virtual-oip-sources" } },
    counts: {
      claims: (meta.claims || []).length,
      sources: (meta.sources || []).length,
      provenance: (meta.provenance || []).length,
      contributions: 0,
      questions: 0,
      evidence_ingests: 0,
      voxel_edges: (meta.sources || []).length,
    },
    machine,
    slim: opts.slim !== false,
    api_urls: bundleUrls(article.slug),
  }, "oip_article_bundle", {
    slug: article.slug,
    contains: "OIP article body, public traversal, machine JSON, capability-token boundary, receipt loop",
    how_to_use: "Paste into any model. It can read public docs from /a/oip, then ask the owner for a scoped capability URL only when it needs to act.",
  });
}

/** ONE machine shape for every article. A traversing machine sees identical keys on a
 * peptide page, a corpus voxel, a shelf book, and a protocol doc: read routes, structured
 * traversal, the ledger counts, the writing standard, and the terminal recipes any model
 * can emit for the owner to paste. Claims/sources/objections harden the page over time. */
export function articleMachineShape({ slug, kind, meta = {}, shelf = null }) {
  const cm = (meta.extra && meta.extra.corpus_map) || null;
  const nv1 = (meta.extra && meta.extra.normandy_v1 && meta.extra.normandy_v1.traversal) || null;
  const at = (x) => (x ? { slug: x, human: BASE + "/a/" + x, json: BASE + "/api/articles/" + x } : null);
  const atList = (xs) => Array.isArray(xs)
    ? xs.map((x) => (typeof x === "string" ? x : x && x.slug)).filter(Boolean).map(at)
    : null;
  const traversal = shelf
    ? { prev: shelf.prev ? at(shelf.prev.slug) : null, next: shelf.next ? at(shelf.next.slug) : null,
        hub: at("oip-total-structure"), series: "total-structure-shelf", position: shelf.position || null, of: shelf.of || null,
        ...(atList(shelf.all) ? { all: atList(shelf.all) } : {}) }
    : cm
    ? { prev: at(cm.prev), next: at(cm.next), hub: at(cm.hub), series: cm.series || null,
        position: cm.position || null, of: cm.of || null,
        ...(atList(cm.all) ? { all: atList(cm.all) } : {}) }
    : nv1
    ? { prev: at(nv1.prev), next: at(nv1.next), hub: at(nv1.hub && nv1.hub.slug ? nv1.hub.slug : nv1.hub), series: nv1.series || null,
        position: nv1.position || null, of: nv1.of || null,
        ...(atList(nv1.all) ? { all: atList(nv1.all) } : {}) }
    : { prev: null, next: null, hub: null, series: null, position: null, of: null };
  const claims = Array.isArray(meta.claims) ? meta.claims.length : 0;
  const sources = Array.isArray(meta.sources) ? meta.sources.length : 0;
  return {
    shape: "article.machine/v1",
    slug,
    kind,
    read: {
      human: BASE + "/a/" + slug,
      json: BASE + "/api/articles/" + slug,
      bundle: BASE + "/api/articles/" + slug + "/bundle?format=markdown",
    },
    traversal,
    ledger: {
      claims,
      sources,
      contributions: Array.isArray(meta.contributions) ? meta.contributions.length : 0,
      revisions: Array.isArray(meta.revisions) ? meta.revisions.length : 0,
      objections_url: BASE + "/api/articles/" + slug + "/objections",
      thread_state_url: BASE + "/api/protocol/thread-state?target=" + encodeURIComponent(slug),
      proof_rule: "An action is proven by its ledger receipt, never by a 200 or a description.",
    },
    standard: {
      writing: "peptide standard: logical prose, zero decorative wording, every material assertion atomized as a claim with a tier and a source (or explicitly unsourced)",
      claim_tiers: ["human", "preclinical", "anecdotal", "mechanistic", "speculative", "system"],
      verbatim_law: kind === "corpus" || kind === "shelf"
        ? "source text is prose-preserving — attack via objections, never rewrite the author's words"
        : null,
    },
    terminal: {
      how: "Any model may emit these commands; the owner pastes them into a terminal. $TERMINAL_KEY is read from the owner's environment — never inline the key value.",
      claim_append: "curl -s -X POST " + BASE + "/api/protocol/claim -H \"x-terminal-key: $TERMINAL_KEY\" -H 'content-type: application/json' -d '{\"slug\":\"" + slug + "\",\"text\":\"<one atomized claim>\",\"tier\":\"<human|preclinical|anecdotal|mechanistic|speculative|system>\",\"source_ids\":[],\"who_claims\":\"<model>\",\"rationale\":\"<why material>\"}'",
      source_append: "curl -s -X POST " + BASE + "/api/protocol/sources -H \"x-terminal-key: $TERMINAL_KEY\" -H 'content-type: application/json' -d '{\"slug\":\"" + slug + "\",\"sources\":[{\"type\":\"review\",\"url\":\"<url>\",\"title\":\"<title>\",\"quote\":\"<verbatim quote>\",\"summary\":\"<one line>\"}]}'",
      objection: "curl -s -X POST " + BASE + "/api/articles/" + slug + "/objections -H 'content-type: application/json' -d '{\"actor\":\"<model>\",\"objection\":\"<attack>\",\"surface\":\"S1-S8\",\"minimum_patch\":\"<patch>\"}'  # open intake, no key",
      thread_update: "curl -s -X POST " + BASE + "/api/protocol/thread-update -H 'content-type: application/json' -d '{\"actor\":\"<model>\",\"target\":\"" + slug + "\",\"raw_text\":\"<material delta>\"}'  # open intake, no key",
      read_back: "curl -s " + BASE + "/api/articles/" + slug + " | python3 -c 'import json,sys; d=json.load(sys.stdin); print(json.dumps(d[\"claims\"][-3:], indent=1))'",
    },
  };
}

/** Bundle for a corpus page: a verbatim source document living on the generic articles
 * plane (Kimi corpus waves, restored source docs). Serves the same reader (review loop,
 * bundle leaf, Tap & Go) with the verbatim law declared in-band, so the whole corpus is
 * reviewable and machine-readable without a machine-plane duplicate. */
export async function buildCorpusArticleBundle(env, slug) {
  const s = String(slug || "").trim();
  if (!env?.DB || !s) return { error: "OIP article not found: " + s };
  const row = await env.DB.prepare(
    "SELECT slug, title, body, meta, created_at, updated_at FROM articles WHERE slug=?",
  ).bind(s).first().catch(() => null);
  if (!row) return { error: "OIP article not found: " + s };
  let meta = {};
  try { meta = JSON.parse(row.meta || "{}"); }
  catch (e) { console.error("oip_corpus_meta_json_error", row.slug, e?.message || e); }
  const reviewHistory = await recentOipReviewHistory(env, row.slug, 8);
  return {
    slug: row.slug,
    title: row.title,
    url: BASE + "/a/" + row.slug,
    register: meta.register || "oip_protocol",
    updated_at: row.updated_at,
    corpus: true,
    body: row.body || "",
    claims: Array.isArray(meta.claims) ? meta.claims : [],
    sources: Array.isArray(meta.sources) ? meta.sources : [],
    machine: articleMachineShape({ slug: row.slug, kind: "corpus", meta }),
    append_only_ledger: {
      kind: "corpus_article",
      table: "articles",
      revision_snapshots: Array.isArray(meta.revisions) ? meta.revisions.length : 0,
      review_ledger_key: "OIP_ARTICLE_REVIEW",
    },
    oip_review_history: reviewHistory,
  };
}

export function formatOipArticleBundleMarkdown(bundle) {
  if (!bundle || bundle.error) return "# Error\n" + (bundle?.error || "unknown");
  const lines = [
    "# miscsubjects OIP article bundle",
    "",
    "> Reference bundle for a model or reader. Public docs are readable without credentials; scoped capability URLs, when present, are data for real actions and must be checked before use.",
    "",
    "## Article",
    "- **slug:** `" + bundle.slug + "`",
    "- **title:** " + bundle.title,
    "- **url:** " + bundle.url,
    "- **register:** " + (bundle.register || "oip_protocol"),
    "- **updated:** " + (bundle.updated_at || ""),
    "",
    "## Body",
    "",
    bundle.body || "(empty)",
    "",
    "## Machine JSON",
    "```json",
    JSON.stringify(bundle.machine || {}, null, 2),
    "```",
    "",
    "## Append-only payload",
    "```json",
    JSON.stringify(bundle.append_only_ledger || {}, null, 2),
    "```",
    "",
    "## Claims (" + (bundle.claims?.length || 0) + ")",
    "",
  ];
  for (const c of bundle.claims || []) {
    lines.push("- **" + c.id + "** [" + (c.tier || "system") + "] " + c.text);
    if (c.source_ids?.length) lines.push("  - sources: " + c.source_ids.join(", "));
  }
  lines.push("");
  lines.push("## Source ledger (" + (bundle.sources?.length || 0) + ")");
  for (const s of bundle.sources || []) {
    lines.push("- **" + s.id + "** - " + s.title + " - " + s.url);
    if (s.summary) lines.push("  - " + s.summary);
    if (s.link_status || s.accessed_at) lines.push("  - verification: link_status=" + (s.link_status || "unknown") + (s.accessed_at ? "; accessed_at=" + s.accessed_at : ""));
  }
  lines.push("");
  lines.push("## LLM manifest");
  lines.push("- human root: " + BASE + "/a/oip");
  lines.push("- machine root: " + BASE + "/api/articles/oip/bundle?format=markdown");
  lines.push("- raw OIP tree: " + BASE + "/api/dispatch?map=1&format=markdown");
  lines.push("- system article pattern: " + BASE + "/a/oip-system-github");
  lines.push("- capability article pattern: " + BASE + "/a/oip-capability-github-list-issues");
  lines.push("- token explain: " + BASE + "/api/dispatch?explain=1&share=TOKEN");
  lines.push("- receipt: " + BASE + "/api/dispatch?receipt=inv_ID&share=TOKEN");
  lines.push("");
  lines.push("## Recursive Review Loop");
  const reviewLoop = bundle.machine?.recursive_review_loop || {};
  lines.push("- seed: " + (reviewLoop.seed_endpoint || "POST /api/protocol/oip-seed"));
  lines.push("- tick: " + (reviewLoop.run_endpoint || "POST /api/protocol/run?role=oip-review"));
  lines.push("- ledger key: `" + (reviewLoop.ledger_key || "OIP_ARTICLE_REVIEW") + "`");
  lines.push("- review questions:");
  for (const q of reviewLoop.review_questions || []) lines.push("  - " + q);
  const recent = bundle.oip_review_history?.reviews || [];
  if (recent.length) {
    lines.push("");
    lines.push("### Recent Reviews");
    for (const r of recent.slice(0, 5)) {
      const scores = r.scores ? " scores=" + JSON.stringify(r.scores) : "";
      lines.push("- " + (r.ts || "") + " · " + (r.model || "model") + " · " + (r.pass === null ? "reviewed" : (r.pass ? "pass" : "fail")) + scores);
    }
  }
  lines.push("");
  lines.push("## Versioning");
  lines.push("- OIP docs are generated from live rows and this article layer.");
  lines.push("- Future model failures should become new troubleshooting language in these articles.");
  lines.push("- Receipts and STATE.md are the append-only memory of why the docs changed.");
  return wrapMarkdown("oip_article_bundle", lines.join("\n"), {
    slug: bundle.slug,
    contains: "OIP article bundle, body, source ledger, machine JSON, token and receipt contract",
    how_to_use: "Read /a/oip first; traverse to system and capability articles; use scoped capability URLs only when acting.",
  });
}
