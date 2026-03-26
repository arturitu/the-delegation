---
name: Web Search Demo
description: Grants the agent the ability to search the web for real-time information.
tools:
  - name: web_search
    description: Search the web for specific information.
    parameters:
      type: object
      properties:
        query:
          type: string
          description: The search query.
      required: [query]
---

# Web Search Demo Skill

This skill allows the agent to access real-time information from the internet.

## Instructions
- Use this skill when the project brief requires information that is not present in the current conversation history.
- Be specific with your queries to get the most relevant results.
- Synthesize the search results into actionable insights for the team.
