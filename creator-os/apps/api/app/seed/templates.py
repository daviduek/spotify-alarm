"""Initial prompt template seed bodies (PRD section 17 / schema section 8.6)."""
from __future__ import annotations

PROMPT_TEMPLATES: list[dict] = [
    {
        "slug": "travel_luxury_airport",
        "name": "Travel Luxury Airport",
        "pillar_slug": "travel_luxury",
        "prompt_body": (
            "Create a vertical 9:16 luxury travel scene for Sasha Van.\n"
            "Character: {identity_prompt_anchor}\n"
            "Scene: premium airport departure or private terminal energy, carry-on luggage, "
            "polished travel outfit, cinematic lighting, aspirational but candid.\n"
            "Mood: selective, mysterious, high-status, out of town but still in control.\n"
            "Avoid: {negative_identity_constraints}\n"
            "Output should feel like a real lifestyle post, not an advertisement."
        ),
    },
    {
        "slug": "hotel_suite_mirror",
        "name": "Hotel Suite Mirror",
        "pillar_slug": "luxury_night_lifestyle",
        "prompt_body": (
            "Create a vertical 9:16 luxury hotel suite mirror scene for Sasha Van.\n"
            "Character: {identity_prompt_anchor}\n"
            "Scene: elegant hotel suite, warm lighting, travel wardrobe, mirror composition, "
            "subtle private-life energy.\n"
            "Mood: intimate but not explicit for public social acquisition, polished, premium, selective.\n"
            "Avoid: {negative_identity_constraints}"
        ),
    },
    {
        "slug": "miami_night_car",
        "name": "Miami Night Car",
        "pillar_slug": "luxury_night_lifestyle",
        "prompt_body": (
            "Create a vertical 9:16 Miami night luxury car lifestyle scene for Sasha Van.\n"
            "Character: {identity_prompt_anchor}\n"
            "Scene: city lights, luxury car interior or arrival moment, elegant outfit, "
            "warm night reflections, after-hours energy.\n"
            "Mood: powerful, selective, cinematic.\n"
            "Avoid: {negative_identity_constraints}"
        ),
    },
    {
        "slug": "rooftop_after_hours",
        "name": "Rooftop After Hours",
        "pillar_slug": "luxury_night_lifestyle",
        "prompt_body": (
            "Create a vertical 9:16 rooftop after-hours scene for Sasha Van.\n"
            "Character: {identity_prompt_anchor}\n"
            "Scene: skyline, rooftop, elegant evening outfit, city lights, post-work luxury mood.\n"
            "Mood: quiet confidence, private life, high-status.\n"
            "Avoid: {negative_identity_constraints}"
        ),
    },
    {
        "slug": "luxury_resort_morning",
        "name": "Luxury Resort Morning",
        "pillar_slug": "travel_luxury",
        "prompt_body": (
            "Create a vertical 9:16 resort morning lifestyle scene for Sasha Van.\n"
            "Character: {identity_prompt_anchor}\n"
            "Scene: Miami or luxury resort balcony, morning light, coffee, premium travel atmosphere.\n"
            "Mood: calm, controlled, aspirational, private morning routine.\n"
            "Avoid: {negative_identity_constraints}"
        ),
    },
    {
        "slug": "private_dinner_fit",
        "name": "Private Dinner Fit",
        "pillar_slug": "luxury_night_lifestyle",
        "prompt_body": (
            "Create a vertical 9:16 private dinner outfit scene for Sasha Van.\n"
            "Character: {identity_prompt_anchor}\n"
            "Scene: elegant restaurant arrival, luxury outfit, soft warm lighting, high-status dinner energy.\n"
            "Mood: not available to everyone, refined, mysterious.\n"
            "Avoid: {negative_identity_constraints}"
        ),
    },
    {
        "slug": "packing_for_flight",
        "name": "Packing For Flight",
        "pillar_slug": "travel_luxury",
        "prompt_body": (
            "Create a vertical 9:16 travel packing scene for Sasha Van.\n"
            "Character: {identity_prompt_anchor}\n"
            "Scene: luxury luggage, hotel room, outfit planning, passport/travel hints, "
            "no destination fully explained.\n"
            "Mood: private, in motion, controlled.\n"
            "Avoid: {negative_identity_constraints}"
        ),
    },
    {
        "slug": "morning_balcony_miami",
        "name": "Morning Balcony Miami",
        "pillar_slug": "travel_luxury",
        "prompt_body": (
            "Create a vertical 9:16 Miami morning balcony scene for Sasha Van.\n"
            "Character: {identity_prompt_anchor}\n"
            "Scene: balcony, ocean or skyline hint, coffee, soft robe or elevated morning outfit, "
            "premium apartment or hotel atmosphere.\n"
            "Mood: aspirational, quiet, private, disciplined.\n"
            "Avoid: {negative_identity_constraints}"
        ),
    },
]
