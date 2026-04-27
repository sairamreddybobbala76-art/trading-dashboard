from models.schemas import RiskRequest, RiskResult


def calculate_position_size(req: RiskRequest) -> RiskResult:
    risk_amount = req.portfolio_value * (req.risk_percent / 100)
    risk_per_share = abs(req.entry_price - req.stop_loss_price)

    if risk_per_share == 0:
        return RiskResult(
            shares=0, risk_amount=risk_amount,
            position_size=0.0, potential_loss=0.0,
        )

    shares = int(risk_amount / risk_per_share)
    position_size = shares * req.entry_price
    potential_loss = shares * risk_per_share

    return RiskResult(
        shares=shares,
        risk_amount=round(risk_amount, 2),
        position_size=round(position_size, 2),
        potential_loss=round(potential_loss, 2),
    )
