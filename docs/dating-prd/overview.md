# PRD Overview

## Product Summary

The product is a mobile dating app built with a narrow scope and high standards for matching relevance.

The app should feel:

- Fast to join
- Easy to understand
- Strict about relevance
- Safe enough to trust
- Good enough to keep using without artificial monetization pressure

## Problem Statement

Many dating apps become noisy because they ask too little from profiles, show too many irrelevant people, and optimize around engagement mechanics instead of useful matching.

This product should solve that by combining:

- Fast onboarding
- Strong mandatory profile signal
- Hard compatibility filters
- Limited but meaningful preferences
- A simple and high-quality ranking system

## Product Goal

Ship a strong first version of a dating app that can support meaningful local discovery with a compact profile model and a reliable matching system.

## Product Principles

- Quality over feature count
- Compatibility over volume
- Simplicity over cleverness
- Safe defaults over maximal exposure
- Measurable product behavior over intuition-only decisions

## Target User

The initial product is for users who want a simpler dating experience and who care about seeing people that actually fit their basic preferences.

This includes people who:

- Want to complete a profile quickly
- Want to filter by intent and distance
- Care about local relevance
- Prefer fewer but better matches over endless random profiles

## Core User Jobs

Users should be able to:

- Create a profile quickly
- Express who they are with a small number of strong signals
- Filter for gender, age, intent, and distance
- Avoid profiles with unwanted traits
- See a relevant feed
- Match and start chatting with minimal friction
- Stay safe through blocking, reporting, and profile controls

## Success Criteria

The first release should optimize for:

- High onboarding completion
- Strong profile completion quality
- High rate of relevant swipes
- Healthy match-to-conversation ratio
- Good first-session experience for new users
- Low amount of obviously irrelevant profiles

## Primary Product Surface

The first version is centered around five product surfaces:

1. Authentication
2. Profile creation
3. Discovery feed
4. Match and chat
5. Safety and account controls

## Constraints

The product intentionally avoids:

- Monetization mechanics in v1
- Heavy social features
- Media-heavy messaging
- Overly complex profile systems
- Advanced ranking systems that require ML or large-scale data infrastructure

## Dependencies On Product Foundation

This PRD inherits the following already-decided principles from `../dating-product-foundation.md`:

- `what_i_am_looking_for` is a required single-value field
- Distance is part of the MVP
- Tags are limited and closed-catalog
- Likes are unlimited in normal use
- Matching is mutual-like based
- Chat is text-only in v1

## Open Product Questions

These remain open and will need final refinement before implementation is complete:

- Final tag catalog
- Exact onboarding copy
- Final wording for gender and intent options
- Exact thresholds for low-supply fallback
