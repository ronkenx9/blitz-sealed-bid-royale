import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, TEE_URL, MAINNET_URL, PERMISSION_PROGRAM_ID } from "./constants";

export const mainnetConnection = new Connection(MAINNET_URL, "confirmed");

export const teeConnection = new Connection(TEE_URL, {
    wsEndpoint: "wss://tee.magicblock.app",
    commitment: "confirmed",
});

export const BLITZ_PROGRAM_ID = new PublicKey(PROGRAM_ID);

export function getGamePda(gameId: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("game"), new anchor.BN(gameId).toArrayLike(Buffer, "le", 8)],
        BLITZ_PROGRAM_ID
    );
}

export function getPlayerStatePda(gameId: number, player: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("player_state"),
            new anchor.BN(gameId).toArrayLike(Buffer, "le", 8),
            player.toBuffer(),
        ],
        BLITZ_PROGRAM_ID
    );
}

export function getVaultPda(gameId: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), new anchor.BN(gameId).toArrayLike(Buffer, "le", 8)],
        BLITZ_PROGRAM_ID
    );
}

export function getRoundItemPda(gameId: number, round: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("round_item"),
            new anchor.BN(gameId).toArrayLike(Buffer, "le", 8),
            Buffer.from([round]),
        ],
        BLITZ_PROGRAM_ID
    );
}

export function getPermissionPda(account: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("permission"), account.toBuffer()],
        new PublicKey(PERMISSION_PROGRAM_ID)
    );
    return pda;
}
