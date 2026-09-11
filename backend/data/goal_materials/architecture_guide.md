# NextGen AI Platform Guide

## Overview
NextGen AI is an editorial-grade conversational system powered by Google Gemini and a three-tier memory architecture.

## Memory Architecture
The system employs three distinct tiers of memory:
1. **Tier 1: Working Memory**: A session-isolated sliding window residing in RAM that keeps the recent turns and automatically trims older turns according to a 3,000-token budget while preserving the last two turns.
2. **Tier 2: Context Cache**: An explicit server-side context cache on Google Gemini for large static documentation, managed with a Time-To-Live (TTL) of 3,600 seconds.
3. **Tier 3: Long-Term Episodic Memory**: A persistent ChromaDB vector store that indexes ingested documents and opportunistically stores user facts, team context, and preferences.

## Tool Capabilities
The assistant can execute native tools:
- `get_general_info`: Domain knowledge discovery.
- `generate_data_metric`: Generates structured stat cards for metrics and KPI values.
- `generate_comparison_table`: Creates structured tables for side-by-side trade-off analysis.
- `generate_badge_list`: Highlights categorical skills or technical tags.
