import { PlayerDimensionChangeAfterEvent, PlayerSpawnAfterEvent, world } from "@minecraft/server";
import { get } from "../util/database";

function _tryLockDimension(player) {
    if (player.isOp()) return;
    const dimensionId = player.dimension.id;
    const lockEnd = get("endLock");
    const lockNether = get("netherLock");
    if ((lockNether && dimensionId === "minecraft:nether") || (lockEnd && dimensionId === "minecraft:the_end")) {
        player.teleport(world.getDefaultSpawnLocation(), {
            dimension: world.getDimension("minecraft:overworld"),
        });
    }
}

export function endNetherLockOn() {
    world.afterEvents.playerDimensionChange.subscribe(onDimensionChange);
    world.afterEvents.playerSpawn.subscribe(onJoin);
}

export function endNetherLockOff() {
    world.afterEvents.playerDimensionChange.unsubscribe(onDimensionChange);
    world.afterEvents.playerSpawn.unsubscribe(onJoin);
}

export function checkNetherEnd() {
    const lockEnd = get("endLock");
    const lockNether = get("netherLock");
    if (!lockEnd && !lockNether) return;
    world.getAllPlayers().forEach((player) => {
        _tryLockDimension(player);
    });
}

function onDimensionChange({ player }: PlayerDimensionChangeAfterEvent) {
    _tryLockDimension(player);
}

function onJoin({ player, initialSpawn }: PlayerSpawnAfterEvent) {
    if (!initialSpawn) return;
    _tryLockDimension(player);
}
