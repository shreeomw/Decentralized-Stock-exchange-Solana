import { startAnchor } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import * as anchor from '@project-serum/anchor';
import { BN, Program } from "@project-serum/anchor";


const IDL = require("../target/idl/decentralized_exchange.json");
import { DecentralizedExchange } from '../target/types/decentralized_exchange';

const PUPPET_PROGRAM_ID = new PublicKey("FXGz1xS6wL6uPXHwzSf6fS95gac9zzsYjsAnRYmZdRxn");

describe('Create a system account', () => {

    test("bankrun", async () => {
        const context = await startAnchor("", [{ name: "decentralized_exchange", programId: PUPPET_PROGRAM_ID }], []);
        const provider = new BankrunProvider(context);
        const wallet = provider.wallet;
        const puppetProgram = anchor.workspace.DecentralizedExchange as Program<DecentralizedExchange>;
        let decentralizedExchangeSystemPda: PublicKey;
        let bump: number;
        let stockAccount: PublicKey;

        [decentralizedExchangeSystemPda, bump] = PublicKey.findProgramAddressSync(
            [Buffer.from("System Account")],
            puppetProgram.programId
        );

        await puppetProgram.methods
            .initializeDecentralizedExchangeSystem()

            .accounts({
                decentralizedExchangeSystem: decentralizedExchangeSystemPda,
                user: wallet.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        // Fetch the decentralized exchange account to verify initialization
        const account = await puppetProgram.account.systemExchangeAccount.fetch(decentralizedExchangeSystemPda);

        // Assertions to verify the state of the initialized account
        console.log("Decentralized Exchange Account State:", account);


        const [_stockAccount] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("Stock Account"), provider.wallet.publicKey.toBuffer()],
            puppetProgram.programId
        );
        stockAccount = _stockAccount;

        // Derive the PDA for the stock account
        const [stockAccountPda, bumpStock] = PublicKey.findProgramAddressSync(
            [Buffer.from("Stock Account"), stockAccount.toBuffer()],
            puppetProgram.programId
        );


        const name = "TestStock";
        const totalSupply = new anchor.BN(1_000_000);
        const dividends = true;
        const dividendPaymentPeriod = new anchor.BN(30); // 30 days
        const currentTime = (await provider.connection.getBlockTime(await provider.connection.getSlot()))!;
        const dateToGoPublic = currentTime + 7 * 24 * 60 * 60; // 7 days from now
        const priceToGoPublic = new anchor.BN(100);

        await puppetProgram.methods
            .createStock(
                name,
                new anchor.BN(totalSupply),
                dividends,
                new anchor.BN(dividendPaymentPeriod),
                new anchor.BN(dateToGoPublic),
                new anchor.BN(priceToGoPublic),
            )
            .accounts({
                decentralizedExchangeSystem: decentralizedExchangeSystemPda,
                stockAccount: stockAccount,
                from: wallet.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        const stockAccount1 = await puppetProgram.account.stockAccount.fetch(stockAccount);

        console.log("Stock Account State:", stockAccount1);

    });
});
