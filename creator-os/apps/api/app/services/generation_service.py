"""Generation job orchestration (Alpha: mock provider, inline execution)."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Asset, AssetVersion, Character, CharacterIdentityProfile, GenerationJob, PromptTemplate
from app.models.enums import AssetSourceType, AssetStatus, JobStatus
from app.services.generation import get_generation_provider


def render_prompt(db: Session, job: GenerationJob) -> str:
    """Render the prompt body using the character identity anchor."""
    if job.prompt_text:
        base = job.prompt_text
    elif job.prompt_template_id:
        template = db.get(PromptTemplate, job.prompt_template_id)
        base = template.prompt_body if template else ""
    else:
        base = "Generate a Sasha Van lifestyle asset."

    anchor = ""
    negative = ""
    if job.character_id:
        profile = (
            db.query(CharacterIdentityProfile)
            .filter(CharacterIdentityProfile.character_id == job.character_id)
            .first()
        )
        if profile:
            anchor = profile.prompt_anchor or ""
            negative = profile.negative_identity_constraints or ""
    return (
        base.replace("{identity_prompt_anchor}", anchor).replace("{negative_identity_constraints}", negative)
    )


def process_generation_job(db: Session, job: GenerationJob) -> GenerationJob:
    """Run a generation job through the configured provider and store assets."""
    job.status = JobStatus.RUNNING
    job.started_at = datetime.now(timezone.utc)
    db.add(job)
    db.commit()

    prompt = render_prompt(db, job)
    provider = get_generation_provider()
    try:
        result = provider.generate(
            job_type=job.job_type,
            prompt=prompt,
            count=job.requested_output_count,
            parameters=job.parameters,
        )
    except Exception as exc:  # noqa: BLE001
        job.status = JobStatus.FAILED
        job.error_code = "provider_error"
        job.error_message = str(exc)[:500]
        job.completed_at = datetime.now(timezone.utc)
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    job.external_job_id = result.external_job_id
    job.provider_model = result.provider_model
    job.provider_response = result.provider_response
    job.prompt_text = prompt

    asset_type = "video" if "video" in job.job_type else "image"
    for output in result.outputs:
        asset = Asset(
            workspace_id=job.workspace_id,
            character_id=job.character_id,
            generation_job_id=job.id,
            asset_type=asset_type,
            source_type=AssetSourceType.GENERATED,
            status=AssetStatus.GENERATED,
            provider_type=job.provider_type,
            provider_model=result.provider_model,
            original_prompt=prompt,
            storage_key=output.storage_key,
            public_url=output.public_url,
            mime_type=output.mime_type,
            width=output.width,
            height=output.height,
            aspect_ratio=output.aspect_ratio,
            metadata_=output.metadata,
            created_by_user_id=job.created_by_user_id,
        )
        db.add(asset)
        db.flush()
        db.add(
            AssetVersion(
                asset_id=asset.id,
                version_number=1,
                generation_job_id=job.id,
                storage_key=output.storage_key,
                public_url=output.public_url,
                mime_type=output.mime_type,
                prompt_text=prompt,
                changes_summary="Initial generation",
                metadata_=output.metadata,
                created_by_user_id=job.created_by_user_id,
            )
        )

    job.status = JobStatus.COMPLETED
    job.completed_at = datetime.now(timezone.utc)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job
