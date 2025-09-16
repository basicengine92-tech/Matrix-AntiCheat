import { world, system, Block, Vector3, GameMode, Player, PlayerLeaveAfterEvent, EntityHurtAfterEvent, PlayerBreakBlockAfterEvent } from "@minecraft/server";
import { flag, isAdmin, c } from "../../Assets/Util";
import { MinecraftBlockTypes } from "../../node_modules/@minecraft/vanilla-data/lib/index";
import lang from "../../Data/Languages/lang";

// Predefined block sets
const POWDER_BLOCKS = new Set([
    MinecraftBlockTypes.RedConcretePowder,
    MinecraftBlockTypes.BlueConcretePowder,
    MinecraftBlockTypes.GreenConcretePowder,
    MinecraftBlockTypes.YellowConcretePowder,
    MinecraftBlockTypes.BlackConcretePowder,
    MinecraftBlockTypes.BrownConcretePowder,
    MinecraftBlockTypes.CyanConcretePowder,
    MinecraftBlockTypes.GrayConcretePowder,
    MinecraftBlockTypes.LightBlueConcretePowder,
    MinecraftBlockTypes.LightGrayConcretePowder,
    MinecraftBlockTypes.LimeConcretePowder,
    MinecraftBlockTypes.MagentaConcretePowder,
    MinecraftBlockTypes.OrangeConcretePowder,
    MinecraftBlockTypes.PinkConcretePowder,
    MinecraftBlockTypes.PurpleConcretePowder,
    MinecraftBlockTypes.WhiteConcretePowder,
]);

const PASSABLE_BLOCKS = new Set([
    MinecraftBlockTypes.Sand,
    MinecraftBlockTypes.Gravel,
    MinecraftBlockTypes.SoulSand,
]);

const safeLocation = new Map<string, Vector3>();
const lastLocation = new Map<string, Vector3>();
const lastFlag = new Map<string, number>();
const lastFlag2 = new Map<string, number>();

// Utility: check if block is solid and not passable
const isSolidBlock = (block: Block) =>
    block?.isSolid && !PASSABLE_BLOCKS.has(block.typeId as MinecraftBlockTypes) && !POWDER_BLOCKS.has(block.typeId as MinecraftBlockTypes);

// Bresenham-like line between two points (XZ only)
function straight(start: Vector3, end: Vector3): Vector3[] {
    const points: Vector3[] = [];
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const steps = Math.max(Math.abs(dx), Math.abs(dz));

    if (!steps) return points;

    const xStep = dx / steps;
    const zStep = dz / steps;

    for (let i = 1; i < steps; i++) {
        points.push({ x: Math.floor(start.x + xStep * i), y: end.y, z: Math.floor(start.z + zStep * i) });
    }

    return points;
}

// Anti-NoClip detection for a single player
async function AntiNoClip(player: Player, now: number) {
    const config = c();
    const velocity = player.getVelocity();
    const movementClip = Math.hypot(velocity.x, velocity.z);
    const lastPos = lastLocation.get(player.id);
    const bodyBlock = player.dimension.getBlock({
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y),
        z: Math.floor(player.location.z),
    })?.typeId as MinecraftBlockTypes;

    // Check phase through blocks (A)
    if (
        lastPos &&
        movementClip > 1.2 &&
        !player.isGliding &&
        !(player.lastBreakSolid && now - player.lastBreakSolid < 1750) &&
        Math.abs(velocity.y) < 1.7 &&
        !PASSABLE_BLOCKS.has(bodyBlock) &&
        !POWDER_BLOCKS.has(bodyBlock) &&
        straight(lastPos, player.location).some((loc) => isSolidBlock(player.dimension.getBlock(loc)))
    ) {
        const lastFlagTime = lastFlag2.get(player.id);
        if (!config.slient) player.teleport(lastPos);
        if (lastFlagTime && now - lastFlagTime < 2000) {
            flag(player, "NoClip", "A", config.antiNoClip.maxVL, config.antiNoClip.punishment);
        }
        lastFlag2.set(player.id, now);
    }
    lastLocation.set(player.id, player.location);

    // Velocity-based check (B/C)
    const safePos = safeLocation.get(player.id);
    const lastFlagTime = lastFlag.get(player.id);
    const lastClip = player.lastClip ?? 0;
    const backClip = player.backClip ?? 0;
    const beforeClip = player.beforeClip ?? 0;

    if (
        player.lastSafePos &&
        safePos &&
        player.lastClip != undefined &&
        player.backClip != undefined &&
        player.beforeClip != undefined &&
        ((movementClip < 0.25 && lastClip > config.antiNoClip.clipMove && backClip < 0.25) ||
            (lastClip === backClip && backClip > config.antiNoClip.clipMove && movementClip < 0.25 && beforeClip < 0.25)) &&
        !player.isGliding &&
        !player.isFlying &&
        !(player.lastExplosionTime && now - player.lastExplosionTime < 1000) &&
        !(player.threwTridentAt && now - player.threwTridentAt < 2500) &&
        !(player.lastApplyDamage && now - player.lastApplyDamage < 250)
    ) {
        if (!config.slient) player.teleport(player.lastSafePos);
        if (lastFlagTime && now - lastFlagTime < 850) {
            const msg = [lang(">velocityXZ") + ":" + movementClip.toFixed(2)];
            flag(player, "NoClip", "B", config.antiNoClip.maxVL, config.antiNoClip.punishment, msg);
        }
        lastFlag.set(player.id, now);
    }

    // Update clip history
    player.beforeClip = backClip;
    player.backClip = lastClip;
    player.lastClip = movementClip;

    // Update safe location if player is not in solid block
    const head = player.getHeadLocation();
    const floorHead = { x: Math.floor(head.x), y: Math.floor(head.y), z: Math.floor(head.z) };
    const floorBody = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
    if (!isSolidBlock(player.dimension.getBlock(floorHead)) && !isSolidBlock(player.dimension.getBlock(floorBody))) {
        safeLocation.set(player.id, player.location);
        player.lastSafePos = safePos;
    }
}

// Run Anti-NoClip check on all players
const antiNoClip = () => {
    const players = world.getPlayers({ excludeGameModes: [GameMode.creative, GameMode.spectator] });
    const now = Date.now();
    for (const player of players) {
        if (isAdmin(player)) continue;
        AntiNoClip(player, now);
    }
};

// Event handlers
const playerLeave = ({ playerId }: PlayerLeaveAfterEvent) => {
    safeLocation.delete(playerId);
    lastFlag.delete(playerId);
    lastFlag2.delete(playerId);
};

const playerBreakBlock = ({ player, block: { isSolid } }: PlayerBreakBlockAfterEvent) => {
    if (isSolid) player.lastBreakSolid = Date.now();
};

const entityHurt = ({ hurtEntity }: EntityHurtAfterEvent) => {
    const player = hurtEntity as Player;
    player.lastApplyDamage = Date.now();
};

let id: number;

// Export module
export default {
    enable() {
        id = system.runInterval(antiNoClip, 1);
        world.afterEvents.playerLeave.subscribe(playerLeave);
        world.afterEvents.entityHurt.subscribe(entityHurt, { entityTypes: ["minecraft:player"] });
        world.afterEvents.playerBreakBlock.subscribe(playerBreakBlock);
    },
    disable() {
        safeLocation.clear();
        lastFlag.clear();
        lastFlag2.clear();
        system.clearRun(id);
        world.afterEvents.playerLeave.unsubscribe(playerLeave);
        world.afterEvents.entityHurt.unsubscribe(entityHurt);
        world.afterEvents.playerBreakBlock.unsubscribe(playerBreakBlock);
    },
};
