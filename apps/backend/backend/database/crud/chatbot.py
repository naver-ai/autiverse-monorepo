from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from ..models import JournalEntry, Journal, Comic, Message, InteractionTurn, Dyad, Place, Person
from ..models import JournalEntryStatus, JournalEntryStage, MessageRole, MessageIntent, ComicStatus
import json
import asyncio
from backend.core.socket import emit_comic_generation_started, emit_comic_generation_progress, emit_comic_generation_completed, emit_comic_generation_error

def get_dyad_by_passcode(db: Session, passcode: str) -> Optional[Dyad]:
    """패스코드로 dyad 조회"""
    return db.query(Dyad).filter(Dyad.passcode == passcode).first()

def get_dyad_by_id(db: Session, dyad_id: str) -> Optional[Dyad]:
    """dyad_id로 dyad 조회"""
    dyads = db.query(Dyad).all()
    print(dyads)
    return db.get(Dyad, dyad_id)

def get_dyad_places(db: Session, dyad_id: str) -> List[Place]:
    """dyad의 모든 places 조회"""
    return db.query(Place).filter(Place.dyad_id == dyad_id).all()

def get_place_people(db: Session, place_id: str) -> List[Person]:
    """특정 place에 연결된 people 조회"""
    place = db.query(Place).filter(Place.id == place_id).first()
    if place:
        return place.people
    return []

def create_journal_entry(db: Session, dyad_id: str) -> JournalEntry:
    """새로운 journal entry 생성"""
    journal_entry = JournalEntry(
        dyad_id=dyad_id,
        status=JournalEntryStatus.Initial,
        stage=JournalEntryStage.Intro
    )
    db.add(journal_entry)
    db.commit()
    db.refresh(journal_entry)
    return journal_entry

def get_journal_entry(db: Session, journal_entry_id: str) -> Optional[JournalEntry]:
    """journal entry 조회"""
    return db.get(JournalEntry, journal_entry_id)

def update_journal_entry_stage(db: Session, journal_entry_id: str, stage: JournalEntryStage, status: JournalEntryStatus = None) -> Optional[JournalEntry]:
    """journal entry stage 업데이트"""
    journal_entry = get_journal_entry(db, journal_entry_id)
    if journal_entry:
        journal_entry.stage = stage
        if status:
            journal_entry.status = status
        db.commit()
        db.refresh(journal_entry)
    return journal_entry

def create_journal(db: Session, journal_entry_id: str, dyad_id: str, location: str = None, people: List[str] = None) -> Journal:
    """새로운 journal 생성"""
    journal = Journal(
        journal_entry_id=journal_entry_id,
        dyad_id=dyad_id,
        location=location,
        people=people if people else None,
        events=None,
        summary=None,
        revision_1_count=0,
        revision_2_count=0,
        max_revisions=2,
        comic_intro=None,
        revision_1=None,
        comic_context=None,
        revision_2=None
    )
    db.add(journal)
    db.commit()
    db.refresh(journal)
    return journal

def get_journal(db: Session, journal_entry_id: str) -> Optional[Journal]:
    """journal 조회"""
    return db.query(Journal).filter(Journal.journal_entry_id == journal_entry_id).first()

def update_journal_data(db: Session, journal_entry_id: str, **kwargs) -> Optional[Journal]:
    """journal 데이터 업데이트"""
    journal = get_journal(db, journal_entry_id)
    if journal:
        for key, value in kwargs.items():
            if hasattr(journal, key):
                setattr(journal, key, value)
            else:
                print(f"[DEBUG] update_journal_data: Journal does not have attribute: {key}")
        
        try:
            db.commit()
            db.refresh(journal)
        except Exception as e:
            print(f"[DEBUG] update_journal_data: Database commit failed: {e}")
            db.rollback()
            raise
    else:
        print(f"[DEBUG] update_journal_data: Journal not found for journal_entry_id: {journal_entry_id}")
    
    return journal

def create_comic(db: Session, journal_entry_id: str, journal_id: str, dyad_id: str) -> Comic:
    """새로운 comic 생성"""
    comic = Comic(
        journal_entry_id=journal_entry_id,
        journal_id=journal_id,
        dyad_id=dyad_id,
        first_panel1=None,
        first_panel2=None,
        first_panel3=None,
        first_panel4=None,
        second_panel1=None,
        second_panel2=None,
        second_panel3=None,
        second_panel4=None,
        status=None
    )
    db.add(comic)
    db.commit()
    db.refresh(comic)
    return comic

def get_comic(db: Session, journal_entry_id: str) -> Optional[Comic]:
    """comic 조회"""
    return db.query(Comic).filter(Comic.journal_entry_id == journal_entry_id).first()

async def update_comic_status(db: Session, journal_entry_id: str, status: ComicStatus, comic_data: dict | None = None):
    """만화 생성 상태 업데이트"""
    comic = db.query(Comic).filter(Comic.journal_entry_id == journal_entry_id).first()
    if comic:
        comic.status = status
        db.commit()
        print(f"[DEBUG] Comic status updated to {status} for {journal_entry_id}")

        if status == ComicStatus.Error:
            await emit_comic_generation_error(comic.dyad_id, journal_entry_id, comic_data)    

        if status == ComicStatus.Generating0:
            await emit_comic_generation_started(comic.dyad_id, journal_entry_id, comic_data)
        await emit_comic_generation_progress(comic.dyad_id, journal_entry_id, status, comic_data)
        if status == ComicStatus.Completed:
            await emit_comic_generation_completed(comic.dyad_id, journal_entry_id, comic_data)

def get_comic_status(db: Session, journal_entry_id: str) -> Optional[str]:
    """comic 생성 상태 조회 (통합)"""
    comic = get_comic(db, journal_entry_id)
    return comic.status if comic else None

def update_comic_panels(db: Session, journal_entry_id: str, is_first_generation: bool = True, **panel_data) -> Optional[Comic]:
    """comic 패널 업데이트"""
    comic = get_comic(db, journal_entry_id)
    if comic:
        prefix = "first_" if is_first_generation else "second_"
        for panel_num in range(1, 5):
            panel_key = f"{prefix}panel{panel_num}"
            if panel_key in panel_data:
                setattr(comic, panel_key, panel_data[panel_key])
        db.commit()
        db.refresh(comic)
    return comic

def update_comic_data(db: Session, journal_entry_id: str, **kwargs) -> Optional[Comic]:
    """comic 데이터 업데이트 (더 유연한 방식)"""
    comic = get_comic(db, journal_entry_id)
    if comic:
        for key, value in kwargs.items():
            if hasattr(comic, key):
                setattr(comic, key, value)
        db.commit()
        db.refresh(comic)
    return comic

def create_interaction_turn(db: Session, journal_entry_id: str, stage: JournalEntryStage, context_metadata: Dict[str, Any] = None) -> InteractionTurn:
    """새로운 interaction turn 생성"""
    interaction_turn = InteractionTurn(
        journal_entry_id=journal_entry_id,
        stage=stage,
        context_metadata=context_metadata
    )
    db.add(interaction_turn)
    db.commit()
    db.refresh(interaction_turn)
    return interaction_turn

def get_latest_interaction_turn(db: Session, journal_entry_id: str) -> Optional[InteractionTurn]:
    """가장 최근 interaction turn 조회"""
    return db.query(InteractionTurn).filter(
        InteractionTurn.journal_entry_id == journal_entry_id
    ).order_by(InteractionTurn.created_at.desc()).first()

def create_message(db: Session, journal_entry_id: str, interaction_turn_id: str, content: str, role: MessageRole, 
                   stage: JournalEntryStage = None, 
                   metadata_json: Dict[str, Any] = None, 
                   intent: MessageIntent = None,
                   audio_filename: str = None) -> Message:
    """새로운 message 생성"""
    # stage가 제공되지 않은 경우 interaction turn에서 가져오기
    if stage is None:
        interaction_turn = db.query(InteractionTurn).filter(InteractionTurn.id == interaction_turn_id).first()
        if interaction_turn:
            stage = interaction_turn.stage
    
    message = Message(
        journal_entry_id=journal_entry_id,
        interaction_turn_id=interaction_turn_id,
        content=content,
        role=role,
        stage=stage,
        metadata_json=metadata_json,
        audio_filename=audio_filename
    )

    if intent:
        message.set_intent_metadata(intent)

    db.add(message)
    db.commit()
    db.refresh(message)
    return message

def get_messages_by_journal_entry(db: Session, journal_entry_id: str) -> List[Message]:
    """journal entry의 모든 message 조회"""
    return db.query(Message).filter(
        Message.journal_entry_id == journal_entry_id
    ).order_by(Message.created_at.asc()).all()

def get_messages_by_journal_entry_and_stage(db: Session, journal_entry_id: str, stage: JournalEntryStage) -> List[Message]:
    """journal entry의 특정 stage message 조회"""
    return db.query(Message).filter(
        Message.journal_entry_id == journal_entry_id,
        Message.stage == stage
    ).order_by(Message.created_at.asc()).all()

def get_messages_by_interaction_turn(db: Session, interaction_turn_id: str) -> List[Message]:
    """interaction turn의 모든 message 조회"""
    return db.query(Message).filter(
        Message.interaction_turn_id == interaction_turn_id
    ).order_by(Message.created_at.asc()).all()

def delete_message(db: Session, message_id: str) -> bool:
    """message 삭제"""
    message = db.query(Message).filter(Message.id == message_id).first()
    if message:
        db.delete(message)
        db.commit()
        return True
    return False

def delete_journal_entry(db: Session, journal_entry_id: str) -> bool:
    """journal entry 삭제 (cascade로 관련 데이터도 함께 삭제)"""
    journal_entry = get_journal_entry(db, journal_entry_id)
    if journal_entry:
        db.delete(journal_entry)
        db.commit()
        return True
    return False

def reset_journal_entry(db: Session, journal_entry_id: str) -> Optional[JournalEntry]:
    """journal entry 초기화"""
    journal_entry = get_journal_entry(db, journal_entry_id)
    if journal_entry:
        # 관련 데이터 삭제
        journal = get_journal(db, journal_entry_id)
        if journal:
            db.delete(journal)
        
        comic = get_comic(db, journal_entry_id)
        if comic:
            db.delete(comic)
        
        # interaction turns와 messages는 cascade로 자동 삭제됨
        
        # journal entry 초기화
        journal_entry.status = JournalEntryStatus.Initial
        journal_entry.stage = JournalEntryStage.Intro
        journal_entry.whole_audio = None
        
        db.commit()
        db.refresh(journal_entry)
    return journal_entry 

def update_message_audio_filename(db: Session, message_id: str, audio_filename: str) -> Message:
    """Message의 audio_filename 업데이트"""
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise ValueError(f"Message with id {message_id} not found")
    
    message.audio_filename = audio_filename
    db.commit()
    db.refresh(message)
    return message 

def generate_audio_filename(journal_entry_id: str, stage: str, db: Session) -> str:
    """의미있는 오디오 파일명 생성: {stage}_{increment}.m4a"""
    try:
        # 해당 journal_entry와 stage에서 이미 존재하는 오디오 파일 개수 확인
        existing_count = db.query(Message).filter(
            Message.journal_entry_id == journal_entry_id,
            Message.stage == stage,
            Message.audio_filename.isnot(None)
        ).count()
        
        # increment는 1부터 시작
        increment = existing_count + 1
        
        # 파일명 생성 (journal_entry_id는 폴더명으로 사용되므로 파일명에서는 제외)
        filename = f"{stage}_{increment:03d}.m4a"
        
        return filename
    except Exception as e:
        print(f"Error generating audio filename: {e}")
        # 에러 발생 시 UUID 사용
        import uuid
        return f"{uuid.uuid4()}.m4a" 