"""
StructZero ADK Production Readiness Advisor
============================================
This module uses Google's Agent Development Kit (ADK) to run a structured
production readiness review on a generated architecture blueprint.

It is invoked as a subprocess by the StructZero Node.js backend when a blueprint
is finalized by the 3-way debate engine, adding a Google-native ADK agent
as the final verification pass in the pipeline.

Usage (from Node.js backend):
    STRUCTZERO_GEMINI_KEY=<key> python adk_advisor.py "<base64_encoded_blueprint>"

    The API key is passed via environment variable (not argv) to prevent
    exposure in process listings (ps aux / /proc/[pid]/cmdline).
Output: JSON string written to stdout
    {
        "ready": true/false,
        "score": 82,
        "checklist": [...],
        "blockers": [...],
        "summary": "..."
    }
"""

import sys
import json
import base64
import asyncio
import os

# Google ADK imports
from google.adk.agents import LlmAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.agents.callback_context import CallbackContext
from google.genai import types as genai_types


PRODUCTION_ADVISOR_PROMPT = """
You are a Principal Production Readiness Engineer. Your role is to review
a software architecture blueprint and assess whether it is ready for
production deployment.

Analyze the provided blueprint against these production readiness dimensions:
1. OBSERVABILITY: Logging, metrics, distributed tracing, alerting
2. RESILIENCE: Circuit breakers, retry logic, timeouts, fallbacks, graceful degradation
3. SECURITY: Authentication, authorization, encryption at rest/transit, secrets management
4. SCALABILITY: Horizontal scaling strategy, bottleneck identification, caching layers
5. OPERABILITY: Deployment strategy, rollback plan, health checks, runbooks
6. PERFORMANCE: Response time budgets, resource limits, load testing strategy
7. DATA INTEGRITY: Backup strategy, consistency guarantees, migration safety

For each dimension, assign: PASS / WARN / BLOCK

Return your response as valid JSON only, with this exact structure:
{
  "score": <integer 0-100>,
  "ready": <boolean>,
  "checklist": [
    {"dimension": "OBSERVABILITY", "status": "PASS|WARN|BLOCK", "note": "<one line>"},
    ...7 items total...
  ],
  "blockers": ["<blocker description if any>"],
  "summary": "<2-3 sentence executive summary>"
}

A blueprint scores 100 if all dimensions PASS.
WARN deducts 5 points each. BLOCK deducts 20 points each.
ready=true only if score >= 60 and no BLOCKers exist.
"""


def create_production_advisor_agent(api_key: str) -> LlmAgent:
    """
    Creates a Google ADK LlmAgent configured as a Production Readiness Advisor.
    Uses Gemini 2.5 Flash for fast, cost-efficient structured analysis.
    """
    os.environ["GOOGLE_API_KEY"] = api_key

    agent = LlmAgent(
        name="structzero_production_advisor",
        model="gemini-2.5-flash",
        description=(
            "A specialized production readiness reviewer that evaluates "
            "software architecture blueprints across 7 production dimensions "
            "and returns a structured JSON assessment."
        ),
        instruction=PRODUCTION_ADVISOR_PROMPT,
    )
    return agent


async def run_production_check(blueprint: str, api_key: str) -> dict:
    """
    Runs the ADK LlmAgent against the provided blueprint and returns
    the parsed JSON production readiness report.
    """
    agent = create_production_advisor_agent(api_key)

    session_service = InMemorySessionService()
    session = await session_service.create_session(
        app_name="structzero",
        user_id="system",
        session_id="prod-check-session"
    )

    runner = Runner(
        agent=agent,
        app_name="structzero",
        session_service=session_service
    )

    user_message = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=f"Please review this architecture blueprint for production readiness:\n\n{blueprint[:8000]}")]
    )

    result_text = ""
    async for event in runner.run_async(
        user_id="system",
        session_id="prod-check-session",
        new_message=user_message
    ):
        if event.is_final_response() and event.content and event.content.parts:
            for part in event.content.parts:
                if hasattr(part, "text") and part.text:
                    result_text += part.text

    # Parse JSON from response
    # Strip markdown code fences if present
    clean = result_text.strip()
    if clean.startswith("```"):
        lines = clean.split("\n")
        clean = "\n".join(lines[1:-1]) if lines[-1] == "```" else "\n".join(lines[1:])

    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        # Fallback: return a structured error response
        return {
            "score": 50,
            "ready": False,
            "checklist": [],
            "blockers": ["ADK agent returned non-JSON response — manual review required"],
            "summary": result_text[:500]
        }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Usage: STRUCTZERO_GEMINI_KEY=<key> python adk_advisor.py <base64_blueprint>"
        }))
        sys.exit(1)

    # API key from environment variable (safer than argv — not visible in ps aux)
    api_key = os.environ.get("STRUCTZERO_GEMINI_KEY", "")
    if not api_key:
        print(json.dumps({"error": "STRUCTZERO_GEMINI_KEY environment variable not set."}))
        sys.exit(1)

    # Decode blueprint from base64 (safe for shell transport)
    try:
        blueprint = base64.b64decode(sys.argv[1]).decode("utf-8")
    except Exception as e:
        print(json.dumps({"error": f"Failed to decode blueprint: {str(e)}"}))
        sys.exit(1)

    # Run the ADK agent
    try:
        result = asyncio.run(run_production_check(blueprint, api_key))
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            "score": 0,
            "ready": False,
            "checklist": [],
            "blockers": [f"ADK agent error: {str(e)}"],
            "summary": f"Production readiness check failed: {str(e)}"
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
