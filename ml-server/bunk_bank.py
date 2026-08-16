import math

class BunkBankEngine:
    """
    Deterministic Math & Dual-Tier Holiday Engine
    """
    
    @staticmethod
    def calculate_safe_leaves(total_conducted: int, total_attended: int, target_margin: float) -> int:
        """
        Calculates how many consecutive classes a student can safely miss.
        target_margin is a decimal (e.g., 0.75 for 75%)
        """
        if total_conducted == 0:
            return 0
            
        current_margin = total_attended / total_conducted
        if current_margin <= target_margin:
            return 0
            
        # Formula: floor( (A - M*T) / M )
        safe_leaves = math.floor((total_attended - (target_margin * total_conducted)) / target_margin)
        return max(0, safe_leaves)

    @staticmethod
    def calculate_required_classes(total_conducted: int, total_attended: int, target_margin: float) -> int:
        """
        Calculates how many consecutive classes a student needs to attend to hit the target.
        """
        if total_conducted == 0 and target_margin > 0:
            return 1 # Needs at least 1 class to hit > 0%
            
        current_margin = total_attended / total_conducted if total_conducted > 0 else 0
        if current_margin >= target_margin:
            return 0
            
        # Formula: ceil( (M*T - A) / (1 - M) )
        required = math.ceil(((target_margin * total_conducted) - total_attended) / (1 - target_margin))
        return max(0, required)
