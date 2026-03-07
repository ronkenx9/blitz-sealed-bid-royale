import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Blitz } from '../target/types/blitz';
import fs from 'fs';
import path from 'path';

// Usage: npx ts-node test-devnet.ts
async function main() {
    // 1. Setup connection to Devnet
    const connection = new anchor.web3.Connection('https://api.devnet.solana.com', 'confirmed');

    // 2. Load the developer's default wallet
    const keypairPath = path.resolve(process.env.HOME || process.env.USERPROFILE || '', '.config/solana/id.json');
    if (!fs.existsSync(keypairPath)) {
        throw new Error("Local wallet not found at ~/.config/solana/id.json");
    }
    const keyData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    const walletKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(keyData));
    const wallet = new anchor.Wallet(walletKeypair);

    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    anchor.setProvider(provider);

    // 3. Load program (Assuming target/idl/blitz.json is present)
    const idlPath = path.resolve(__dirname, '../target/idl/blitz.json');
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
    const programId = new anchor.web3.PublicKey("4rBQpg3Fy8ZYYY54QQJmzjUza55ofDPnzxETV2VniYKW");
    const program = new Program(idl, programId, provider) as unknown as Program<Blitz>;

    console.log("🟢 Connected to Devnet");
    console.log("🔑 Payer:", wallet.publicKey.toBase58());
    console.log("📝 Program ID:", program.programId.toBase58());

    // Generate random Game ID
    const gameIdNumber = Math.floor(Math.random() * 1000000);
    const gameId = new anchor.BN(gameIdNumber);
    console.log("🎲 Testing with Game ID:", gameId.toString());

    // Derive PDAs
    const [gamePda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("game"), gameId.toArrayLike(Buffer, "le", 8)],
        program.programId
    );
    const [playerStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("player_state"), gameId.toArrayLike(Buffer, "le", 8), wallet.publicKey.toBuffer()],
        program.programId
    );
    const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), gameId.toArrayLike(Buffer, "le", 8)],
        program.programId
    );

    console.log("Creating Game (PDA:", gamePda.toBase58(), ")...");

    try {
        const tx = await program.methods.createGame(gameId)
            .accounts({
                game: gamePda,
                playerState: playerStatePda,
                vault: vaultPda,
                creator: wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            } as any)
            .rpc();

        console.log("✅ Custom Game Created! TX:", tx);

        // Fetch game state
        const gameState = await program.account.game.fetch(gamePda);
        console.log("📊 Initial Game State:");
        console.log("- Player Count:", gameState.playerCount);
        console.log("- Status:", gameState.status);
        console.log("- Total Pot:", gameState.totalPot.toString());

    } catch (err) {
        console.error("❌ Failed to create game:", err);
    }
}

main().catch(console.error);
