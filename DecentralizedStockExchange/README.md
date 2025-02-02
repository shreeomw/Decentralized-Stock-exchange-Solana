<div align="center">

![stock-exchange](stock-exchange.gif)

# Decentralized stock exchange

</div>

This exchange is based on the Solana blockchain technology, which makes it completely decentralized and highly secure. Thanks to privacy and decentralization, this stock market allows users to carry out financial transactions completely privately and freely, without the need for intermediaries.

By using web3, the technology that enables interaction with the blockchain, users can enjoy a more secure experience free from manipulation by third parties. This means that users have greater control over their financial assets and can make more informed decisions without worrying about third-party interference. Furthermore, thanks to the decentralized nature of the Solana blockchain, the stock market is resistant to censorship and manipulation, making it a completely fair and transparent free market system.

---

## Initialize the market account 

```rust
pub fn initialize_decentralized_exchange_system(ctx: Context<Initialize>) -> Result<()> {
    let system = &mut ctx.accounts.decentralized_exchange_system;
    let (_pda, bump) = Pubkey::find_program_address(&[b"System Account"], ctx.program_id);

    //update state
    system.set_bump(bump);
    system.init_stock_companies();
    system.init_historical_exchanges();
    system.init_total_holders();
    system.init_total_offers();

    Ok(())
}
```

- bump_original is set to the "bump" value generated by finding the program address using Pubkey::find_program_address.
- total_stock_companies, historical_exchanges, total_holders, and total_offers are all set to zero.

The #[derive(Accounts)] macro defines the requirements for the accounts that are needed for the function, in this case, three accounts are required:

- A SystemExchangeAccount to be initialized.
- A user account that will pay for the initialization of the decentralized exchange system account.
- A system program account that will be used to transact on the blockchain.

---

## Create the stock account 

```rust
pub fn create_stock(
    ctx: Context<CreateStock>,
    name: String,
    description: String,
    total_supply: u64,
    dividends: bool,
    dividend_payment_period: i64,
    date_to_go_public: i64,
    price_to_go_public: u64,
) -> Result<()> {
    let (_stock_pda, bump) = Pubkey::find_program_address(
        &[b"Stock Account", ctx.accounts.from.key().as_ref()],
        ctx.program_id,
    );

    //validations
    less_or_equal_than(name.len() as u64, NAME).unwrap();
    less_or_equal_than(description.len() as u64, DESCRIPTION).unwrap();
    check_current_time(date_to_go_public).unwrap();

    //get &mut accounts
    let system = &mut ctx.accounts.decentralized_exchange_system;
    let stock_account = &mut ctx.accounts.stock_account;

    //update state
    system.add_total_stock_companies();
    stock_account.set_bump(bump);
    stock_account.set_pubkey(ctx.accounts.from.key());
    stock_account.set_name(name);
    stock_account.set_description(description);
    stock_account.set_total_supply(total_supply);
    stock_account.set_supply_in_position(total_supply);
    stock_account.set_holders(1);
    stock_account.set_dividends(dividends);
    stock_account.set_dividend_payment_period(dividend_payment_period);
    stock_account.set_date_to_go_public(date_to_go_public);
    stock_account.set_price_to_go_public(price_to_go_public);

    Ok(())
}
```

Creates a stock stock account. The function takes several parameters, including the name and description of the stock, the total number of shares available, whether and how often dividends will be paid, and the date and price of exit at bag.

Returns a result indicating whether the operation was successful or not.

---

## Create a holder account

```rust
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
```

The init_holder_account function is a public (pub) function that is used to initialize a holder account on the decentralized exchange program. This function takes a context (ctx) that includes a data structure called InitHolderAccount that is used to get information about the accounts relevant to the function.

Checks if the PDA account public key of the stock account matches the provided stock account public key, and if not, returns an ErrorCode. If the public keys match, a unique Program Derived Address (PDA) key is generated for the holder account using the public keys of the stock account and the "from" account.

Then updates various accounts, including the decentralized exchange system account, the holder account, and the stock account. The number of holders and the participation account are increased in the holder account, and the total number of holders is increased in the decentralized exchange system account.

---

## Create a buyer account

```rust
pub fn init_buy_account(ctx: Context<InitBuyAccount>) -> Result<()> {
    let (_buy_pda, bump) = Pubkey::find_program_address(
        &[
            b"Buy Account",
            ctx.accounts.stock_account_pda.key().as_ref(),
            ctx.accounts.from.key().as_ref(),
        ],
        ctx.program_id,
    );

    //validation
    require_keys_eq!(
        ctx.accounts.stock_account_pda.key(),
        ctx.accounts.stock_account.key(),
    );

    //get &mut account
    let buy_offer = &mut ctx.accounts.buy_offer;

    //update state
    buy_offer.set_bump(bump);
    buy_offer.init_sell_or_buy_amount();
    buy_offer.init_price();
    buy_offer.set_pubkey(ctx.accounts.from.key());
    buy_offer.set_len(BUY_ACCOUNT);

    Ok(())
}
```

The find_program_address function is used to find the address of the program account (buy_pda) to use for the buy offer. A security check is also performed to ensure that the share account to be purchased is the same as the share account specified in the offer to buy account.
The buy_offer account is then initialized using the Accounts macro. It is specified that the account must be mutable (mut) and the seeds (seeds) necessary to initialize the account are provided. The account is initialized with a specific space (space) and it is specified that the account will be paid from the sender's account (payer)

---

## Create a seller account

```rust
pub fn init_sell_account(ctx: Context<InitSellAccount>) -> Result<()> {
    let (_sell_pda, bump) = Pubkey::find_program_address(
        &[
            b"Sell Account",
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
    require_keys_eq!(
        ctx.accounts.stock_account_pda.key(),
        ctx.accounts.stock_account.key(),
    );

    //get &mut accounts
    let sell_offer = &mut ctx.accounts.sell_offer;

    //update state
    sell_offer.set_bump(bump);
    sell_offer.init_sell_or_buy_amount();
    sell_offer.init_price();
    sell_offer.set_pubkey(ctx.accounts.from.key());
    sell_offer.set_len(SELL_ACCOUNT);

    Ok(())
}
```

The init_sell_account function is responsible for initializing a sale account on the blockchain. It takes as input a Context object that contains information about the program and the current transaction. In particular, the Context object is expected to contain information about the stock account (stock_account) that is going to be sold, as well as information about the user account (from) that is making the sale.


---

## Create an IPO

```rust
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
    less_or_equal_than(amount, ctx.accounts.stock_account.total_supply).unwrap();

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

```

Takes as input a context and an amount, and returns a result. The context entry includes accounts associated with the decentralized exchange system, the share token account, the holder account, and other accounts required to perform the transaction. The feature uses a series of security checks to verify that the amount is greater than zero, that the accounts are authentic, and that the holder has enough tokens to make the purchase.

If these conditions are met, the function performs the transfer of tokens from the buyer's account to the holder's account and updates the information of the holder's account, the stock token account, and the decentralized exchange system account.

---

## Make a sell offer

```rust
pub fn sell_offer(ctx: Context<SellOffer>, sell_amount: u64, price: u64) -> Result<()> {
    let (holder_pda, _bump) = Pubkey::find_program_address(
        &[
            ctx.accounts.stock_account.key().as_ref(),
            ctx.accounts.from.key().as_ref(),
        ],
        ctx.program_id,
    );
    ctx.accounts.sell_offer.price.push(price);

    //validations
    require_keys_eq!(
        ctx.accounts.stock_account_pda.key(),
        ctx.accounts.stock_account.key(),
    );
    require_keys_eq!(holder_pda.key(), ctx.accounts.holder_account.key());
    less_or_equal_than(sell_amount, ctx.accounts.holder_account.participation).unwrap();
    check_unique_of_price(ctx.accounts.sell_offer.price.clone()).unwrap();
    require_gt!(sell_amount, 0).unwrap();

    //get &mut accounts
    let system = &mut ctx.accounts.decentralized_exchange_system;
    let stock_account = &mut ctx.accounts.stock_account;
    let sell_offer = &mut ctx.accounts.sell_offer;
    let holder_account = &mut ctx.accounts.holder_account;

    //update state
    sell_offer.sell_or_buy_amount.push(sell_amount);
    sell_offer.price.push(price);
    sell_offer.add_len(PRODUCT);
    system.add_total_offers();
    stock_account.add_current_offers();
    holder_account.sub_participation(sell_amount);

    Ok(())
}
```

Checks for the uniqueness of the price in the sell offer by calling a nested function unique_elements. If the price is not unique, the function returns an error. Next, the function generates a program-derived address (PDA) for the holder account and checks if it matches the holder account provided. It also checks if the sell amount is greater than zero and if the stock account PDA key matches the provided stock account key.

---

## Make a buy offer 

```rust
pub fn buy_offer(ctx: Context<BuyOffer>, buy_amount: u64, price: u64) -> Result<()> {
    let (holder_pda, _bump) = Pubkey::find_program_address(
        &[
            ctx.accounts.stock_account.key().as_ref(),
            ctx.accounts.from.key().as_ref(),
        ],
        ctx.program_id,
    );

    //validations
    require_keys_eq!(holder_pda.key(), ctx.accounts.holder_account.key());
    require_keys_eq!(ctx.accounts.buy_offer.key(), ctx.accounts.buy_pda.key());
    require_keys_eq!(
        ctx.accounts.stock_account_pda.key(),
        ctx.accounts.stock_account.key(),
    );
    less_or_equal_than(buy_amount, ctx.accounts.stock_account.total_supply).unwrap();
    require_gt!(buy_amount, 0);

    // lamports transfer
    anchor_lang::solana_program::program::invoke(
        &system_instruction::transfer(
            &ctx.accounts.from.key(),
            &ctx.accounts.buy_offer.key(),
            price,
        ),
        &[
            ctx.accounts.from.to_account_info(),
            ctx.accounts.buy_pda.to_account_info().clone(),
        ],
    )
    .expect("Error");

    //get &mut accounts
    let system = &mut ctx.accounts.decentralized_exchange_system;
    let stock_account = &mut ctx.accounts.stock_account;
    let buy_offer = &mut ctx.accounts.buy_offer;

    //update state
    buy_offer.sell_or_buy_amount.push(buy_amount);
    buy_offer.price.push(price);
    buy_offer.add_len(PRODUCT);
    system.add_total_offers();
    stock_account.add_current_offers();

    Ok(())
}
```

The function takes as input a ctx context structure, the amount of assets to buy buy_amount and the bid price price. First, the function verifies the authenticity of the offer holder's account and the validity of the quantity and parameters of the asset account and the offer to buy. It then invokes the transfer function of the Solana system program to transfer the necessary funds from the buyer's account to the purchase offer account.

The accounts for the decentralized systems and the assets involved in the offer are then updated, and the offer details are added to the offer to buy account. Finally, a result is returned indicating the success or failure of the transaction. The BuyOffer framework defines the account requirements and the account information needed to complete the transaction.

---

## Accept a sell offer 

```rust
pub fn accept_a_sell(ctx: Context<AcceptASell>, amount: u64) -> Result<()> {
    let index: usize = get_index(ctx.accounts.sell_offer.price.clone());
    //validations
    require_keys_eq!(
        ctx.accounts.stock_account_pda.key(),
        ctx.accounts.stock_account.key(),
    );
    require_keys_eq!(ctx.accounts.sell_offer.key(), ctx.accounts.sell_pda.key());
    require_eq!(amount, ctx.accounts.sell_offer.price[index]);

    //lamport transfer
    anchor_lang::solana_program::program::invoke(
        &system_instruction::transfer(
            &ctx.accounts.from.key(),
            &ctx.accounts.sell_offer.key(),
            ctx.accounts.sell_offer.price[index],
        ),
        &[
            ctx.accounts.from.to_account_info(),
            ctx.accounts.sell_pda.to_account_info().clone(),
        ],
    )
    .expect("Error");

    //get &mut accounts
    let system = &mut ctx.accounts.decentralized_exchange_system;
    let stock_account = &mut ctx.accounts.stock_account;
    let seller_account = &mut ctx.accounts.seller_account;
    let buyer_account = &mut ctx.accounts.buyer_account;
    let sell_offer = &mut ctx.accounts.sell_offer;

    //update state
    system.add_historical_exchanges();
    system.sub_total_offers();
    stock_account.sub_current_offers();
    seller_account.sub_participation(sell_offer.sell_or_buy_amount[index]);
    buyer_account.add_participation(sell_offer.sell_or_buy_amount[index]);
    sell_offer.sell_or_buy_amount.remove(index);
    sell_offer.price.remove(index);
    sell_offer.sub_len(PRODUCT);

    Ok(())
}
```

Its purpose is to accept a sell offer from a holder account and execute the transaction by transferring the tokens to the buyer and updating the relevant accounts.The function takes in the following parameters:

- ctx: An anchor context that provides access to the accounts used in the function.
- price: The price at which the sell offer is made.

If the sell offer is valid, the function invokes the system_instruction::transfer() function to transfer the tokens from the seller's account to the buyer's account using the invoke() function. It then updates the accounts' information by incrementing or decrementing the relevant fields. The accounts used in the function are defined using the Accounts struct. They are:

---

## Accept a buy offer 

```rust
pub fn accept_a_buy(ctx: Context<AcceptABuy>, amount: u64) -> Result<()> {
    let index: usize = get_index(ctx.accounts.buy_offer.price.clone());
    //validations
    require_keys_eq!(
        ctx.accounts.stock_account_pda.key(),
        ctx.accounts.stock_account.key(),
    );
    require_keys_eq!(ctx.accounts.buy_offer.key(), ctx.accounts.buyer_pda.key());
    require_eq!(amount, ctx.accounts.buy_offer.price[index]);

    /*pda lamport transfer*/
    pda_transfer(
        ctx.accounts.buy_offer.to_account_info(),
        ctx.accounts.from.to_account_info(),
        amount,
    )
    .unwrap();

    //get &mut accounts
    let system = &mut ctx.accounts.decentralized_exchange_system;
    let stock_account = &mut ctx.accounts.stock_account;
    let seller_account = &mut ctx.accounts.seller_account;
    let buyer_account = &mut ctx.accounts.buyer_account;
    let buy_offer = &mut ctx.accounts.buy_offer;

    //update state
    system.add_historical_exchanges();
    system.sub_total_offers();
    stock_account.sub_current_offers();
    seller_account.sub_participation(buy_offer.sell_or_buy_amount[index]);
    buyer_account.add_participation(buy_offer.sell_or_buy_amount[index]);
    buy_offer.sell_or_buy_amount.remove(index);
    buy_offer.price.remove(index);
    buy_offer.sub_len(PRODUCT);

    Ok(())
}
```

First performs some checks to make sure that the transaction is valid and secure. Then, update the details of the accounts involved in the transaction. In particular, it reduces the account balance of the purchase offer in "price" units and increases the account balance of the seller in "price" units. Then, update the counters and tracking data for the decentralized exchange.

---

## Cancel a sell offer 

```rust
pub fn cancel_sell(ctx: Context<CancelSellOffer>, price_to_cancel: u64) -> Result<()> {
    let index: usize = get_index(ctx.accounts.sell_offer.price.clone());
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
    greater_than_0(price_to_cancel).unwrap();
    require_eq!(price_to_cancel, ctx.accounts.sell_offer.price[index]);

    //get &mut accounts
    let system = &mut ctx.accounts.decentralized_exchange_system;
    let stock_account = &mut ctx.accounts.stock_account;
    let holder_account = &mut ctx.accounts.holder_account;
    let sell_offer = &mut ctx.accounts.sell_offer;

    //update state
    sell_offer.sell_or_buy_amount.remove(index);
    sell_offer.price.remove(index);
    sell_offer.sub_len(PRODUCT);
    system.sub_total_offers();
    stock_account.sub_current_offers();
    holder_account.add_participation(price_to_cancel);

    Ok(())
}
```

The function is responsible for canceling an existing sale offer in the exchange system, returning the sold tokens to the owner of the sale account. The function takes as input a CancelSellOffer structure, which contains the accounts needed to cancel the sale offer. It is required that the sale offer is valid and that the cancellation price is greater than zero.

Then looks up the sales quote in the sales account and removes the sales quote corresponding to the cancellation price. The corresponding accounts are then updated to reflect the cancellation of the offer, including the reduction of the total number of offers in the system and the number of sales offers in the stock account. Finally, control is returned to the user and a result is returned indicating whether the cancellation was successful.

---

## Cancel a buy offer ❌

```rust
pub fn cancel_buy(ctx: Context<CancelBuyOffer>, price_to_cancel: u64) -> Result<()> {
    let index: usize = get_index(ctx.accounts.buy_offer.price.clone());

    //validations
    require_keys_eq!(
        ctx.accounts.stock_account_pda.key(),
        ctx.accounts.stock_account.key(),
    );
    require_keys_eq!(ctx.accounts.buy_offer.key(), ctx.accounts.buy_pda.key());
    require_eq!(price_to_cancel, ctx.accounts.buy_offer.price[index]);

    //sign tx
    pda_transfer(
        ctx.accounts.buy_pda.to_account_info(),
        ctx.accounts.from.to_account_info(),
        price_to_cancel,
    )
    .unwrap();

    //get &mut accounts
    let system = &mut ctx.accounts.decentralized_exchange_system;
    let stock_account = &mut ctx.accounts.stock_account;
    let buy_offer = &mut ctx.accounts.buy_offer;

    //update state
    buy_offer.sell_or_buy_amount.remove(index);
    buy_offer.price.remove(index);
    buy_offer.sub_len(PRODUCT);
    system.sub_total_offers();
    stock_account.sub_current_offers();

    Ok(())
}
```

- ctx: A Context object that contains information about the current transaction.
- price_to_cancel: The price of the buy offer that you want to cancel.
The cancel_buy function first checks that the stock account PDA key matches the stock account key and that the buy offer key matches the buy PDA key. If these checks fail, it will return an error code. Next, the function initializes some mutable variables for the system exchange account, stock account, and buy offer. It then uses the iter.position() method to find the index of the buy offer with the specified price. If the price is not found, it will return an error code.

If the price is found, the function removes the sell or buy amount and price from the buy offer account, decrements the total number of offers in the system, and decrements the number of current offers for the stock account. It then returns any funds that were locked up for the canceled buy offer by transferring the lamports from the buy PDA account to the from account. Finally, the function returns an Ok(()) result if everything was successful.
