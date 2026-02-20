import { GameMode, PlayerGameModeChangeBeforeEvent, PlayerSpawnAfterEvent, system, world } from "@minecraft/server";
import { get } from "../util/database";

let isEnabled = false;

export function enableAntiGameMode() {
    if (isEnabled) return;
    isEnabled = true;
    world.beforeEvents.playerGameModeChange.subscribe(gamemodeChange);
    world.afterEvents.playerSpawn.subscribe(onJoin);
}

export function disableAntiGameMode() {
    if (!isEnabled) return;
    isEnabled = false;
    world.beforeEvents.playerGameModeChange.unsubscribe(gamemodeChange);
    world.afterEvents.playerSpawn.unsubscribe(onJoin);
}

function gamemodeChange(event: PlayerGameModeChangeBeforeEvent) {
    if (event.player.isOp()) return;
    let block = false;
    switch (event.toGameMode) {
        case GameMode.Adventure: {
            if (get("antiGma")) block = true;
            break;
        }
        case GameMode.Creative: {
            if (get("antiGmc")) block = true;
            break;
        }
        case GameMode.Spectator: {
            if (get("antiGmsp")) block = true;
            break;
        }
        case GameMode.Survival: {
            if (get("antiGms")) block = true;
        }
    }
    if (block) {
        event.cancel = true;
        system.run(() => event.player.setGameMode(GameMode.Survival));
    }
}

function onJoin({ player, initialSpawn }: PlayerSpawnAfterEvent) {
    if (!initialSpawn || player.isOp()) return;
    let reset = false;
    switch (player.getGameMode()) {
        case GameMode.Adventure: {
            if (get("antiGma")) reset = true;
            break;
        }
        case GameMode.Creative: {
            if (get("antiGmc")) reset = true;
            break;
        }
        case GameMode.Spectator: {
            if (get("antiGmsp")) reset = true;
            break;
        }
        case GameMode.Survival: {
            if (get("antiGms")) reset = true;
        }
    }
    if (reset) {
        player.setGameMode(GameMode.Survival);
    }
}
