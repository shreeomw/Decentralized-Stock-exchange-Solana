use crate::state::accounts::*;
use anchor_lang::{prelude::*, solana_program::*};

pub fn buy_in_initial_public_offering(
    ctx: Context<BuyInitialPublicOffering>,
    amount: u64,
) -> Result<()> {
    let (holder_pda, _bump) = Pubkey::find_program_address(
        &[
            ctx.accounts.stock_account.key().as_ref(),
            ctx.accounts.from.key().as_ref(),
        ],
        ctx.program_id,
    );

    //validations
    require_keys_eq!(
        ctx.accounts.stock_account_pda.key(),
        ctx.accounts.stock_account.key(),
    );
    require_keys_eq!(holder_pda.key(), ctx.accounts.holder_account.key());
    require_gt!(amount, 0);
    require_gte!(ctx.accounts.stock_account.total_supply, amount);

    //lamport transfer
    let amount_to_send: u64 = ctx.accounts.stock_account.price_to_go_public * amount;
    anchor_lang::solana_program::program::invoke(
        &system_instruction::transfer(
            &ctx.accounts.from.key(),
            &ctx.accounts.stock_account_pda.key(),
            amount_to_send,
        ),
        &[
            ctx.accounts.from.to_account_info(),
            ctx.accounts.stock_account_pda.to_account_info().clone(),
        ],
    )
    .expect("Error");

    //get &mut accounts
    let system = &mut ctx.accounts.decentralized_exchange_system;
    let holder_account = &mut ctx.accounts.holder_account;
    let stock_account = &mut ctx.accounts.stock_account;

    //update state
    holder_account.set_participation(amount);
    stock_account.sub_supply_in_position(amount);
    system.add_historical_exchanges();

    Ok(())
}

#[derive(Accounts)]
pub struct BuyInitialPublicOffering<'info> {
    #[account(mut, seeds = [b"System Account"], bump = decentralized_exchange_system.bump_original)]
    pub decentralized_exchange_system: Account<'info, SystemExchangeAccount>,

    #[account(mut, seeds = [b"Stock Account", stock_account.pubkey_original.key().as_ref()], bump = stock_account.bump_original)]
    pub stock_account: Account<'info, StockAccount>,

    #[account(mut, seeds = [stock_account_pda.key().as_ref(), from.key().as_ref()], bump = holder_account.bump_original)]
    pub holder_account: Account<'info, HolderAccount>,

    /// CHECK: This is not dangerous
    #[account(mut)]
    pub stock_account_pda: AccountInfo<'info>,

    /// CHECK: This is not dangerous
    #[account(mut, signer)]
    pub from: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}
