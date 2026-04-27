from fastapi import APIRouter
from models.schemas import RiskRequest, RiskResult
from services.risk_service import calculate_position_size

router = APIRouter(prefix="/api/risk", tags=["risk"])


@router.post("/calculate", response_model=RiskResult)
def calculate(req: RiskRequest):
    return calculate_position_size(req)
