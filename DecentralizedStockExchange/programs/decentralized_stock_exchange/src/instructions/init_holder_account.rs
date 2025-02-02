use crate::state::accounts::*;
use anchor_lang::prelude::*;

pub fn init_holder_account(ctx: Context<InitHolderAccount>) -> Result<()> {
    let (_holder_pda, bump) = Pubkey::find_program_address(
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

    //get &mut accounts
    let system = &mut ctx.accounts.decentralized_exchange_system;
    let holder_account = &mut ctx.accounts.holder_account;
    let stock_account = &mut ctx.accounts.stock_account;

    //update state
    holder_account.set_bump(bump);
    holder_account.init_participation();
    holder_account.set_holder_pubkey(ctx.accounts.from.key());
    stock_account.add_holders();
    system.add_total_holders();

    Ok(())
}

#[derive(Accounts)]
pub struct InitHolderAccount<'info> {
    #[account(mut, seeds = [b"System Account"], bump = decentralized_exchange_system.bump_original)]
    pub decentralized_exchange_system: Account<'info, SystemExchangeAccount>,

    #[account(mut, seeds = [b"Stock Account", stock_account.pubkey_original.key().as_ref()], bump = stock_account.bump_original)]
    pub stock_account: Account<'info, StockAccount>,

    #[account(init, seeds = [stock_account_pda.key().as_ref(), from.key().as_ref()], bump, payer = from, space = HolderAccount::SIZE + 8)]
    pub holder_account: Account<'info, HolderAccount>,

    /// CHECK: This is not dangerous
    #[account(mut)]
    pub stock_account_pda: AccountInfo<'info>,

    /// CHECK: This is not dangerous
    #[account(mut, signer)]
    pub from: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}
