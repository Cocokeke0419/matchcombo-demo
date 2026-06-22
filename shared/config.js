export const GAME_CONFIG = {
  board: {
    size: 8,
    colors: ["ruby", "leaf", "sky", "sun"],
  },

  battle: {
    maxHp: 300,
    damageChargeMax: 140,
    obstacleChargeMax: 160,
    damagePerAttack: 85,
    aiTurnMs: 1450,
    sideChargeMultiplier: {
      player: {
        damage: 1,
        obstacle: 1,
      },
      ai: {
        damage: 1.12,
        obstacle: 1.1,
      },
    },
  },

  input: {
    swipeThresholdPx: 18,
  },

  match: {
    damageChargePerClearedGem: 1,
    obstacleChargePerClearedGem: 1,
  },

  drop: {
    controlledRefill: true,
    generousRefillChance: 0.35,
    maxCascadeSteps: 12,
    refillScore: {
      neutral: 3,
      matchCell: 8,
      propeller: 28,
      rocket: 38,
      bomb: 58,
      colorBall: 90,
    },
  },

  obstacles: {
    crateHp: 1,
  },

  specials: {
    propeller: {
      create: {
        damageCharge: 2,
        obstacleCharge: 8,
      },
      activate: {
        obstacleCharge: 25,
      },
      targetScore: {
        crate: 1000,
        immediateMatchCell: 10,
        createsSpecial: 25,
      },
    },

    rocket: {
      create: {
        damageCharge: 3,
        obstacleCharge: 10,
      },
      activate: {
        obstacleCharge: 30,
      },
    },

    bomb: {
      create: {
        damageCharge: 4,
        obstacleCharge: 15,
      },
      activate: {
        obstacleCharge: 45,
      },
    },

    colorBall: {
      create: {
        damageCharge: 6,
        obstacleCharge: 20,
      },
      activate: {
        obstacleCharge: 60,
      },
    },
  },
};
