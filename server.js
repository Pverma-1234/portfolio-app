const express = require("express")
const sqlite3 = require("sqlite3").verbose()
const cors = require("cors")

const app = express()

app.use(cors())
app.use(express.json())

// serve frontend
app.use(express.static("public"))

const db = new sqlite3.Database("./model_portfolio.db")

// -----------------------------
// GET CLIENT HOLDINGS
// -----------------------------

app.get("/holdings",(req,res)=>{

    const query = `
    SELECT *
    FROM client_holdings
    WHERE client_id='C001'
    `

    db.all(query,(err,rows)=>{

        if(err){
            return res.send(err)
        }

        res.json(rows)

    })

})

app.get("/history",(req,res)=>{

const q=`
SELECT *
FROM rebalance_sessions
WHERE client_id='C001'
ORDER BY created_at DESC
`

db.all(q,(err,rows)=>{

res.json(rows)

})

})


// -----------------------------
// GET MODEL PORTFOLIO
// -----------------------------

app.get("/model",(req,res)=>{

    const query = `
    SELECT *
    FROM model_funds
    `

    db.all(query,(err,rows)=>{

        if(err){
            return res.send(err)
        }

        res.json(rows)

    })

})


// -----------------------------
// REBALANCE CALCULATION
// -----------------------------

app.get("/rebalance",(req,res)=>{
    app.post("/save-rebalance",(req,res)=>{

const sessionQuery=`
INSERT INTO rebalance_sessions
(client_id,portfolio_value,total_to_buy,total_to_sell,net_cash_needed,status)
VALUES(?,?,?,?,?,'PENDING')
`

db.run(sessionQuery,["C001",580000,200000,120000,80000],function(err){

if(err){
return res.send(err)
}

res.json({
message:"Rebalance saved",
session_id:this.lastID
})

})

})

    const holdingsQuery = `
    SELECT *
    FROM client_holdings
    WHERE client_id='C001'
    `

    const modelQuery = `
    SELECT *
    FROM model_funds
    `

    db.all(holdingsQuery,(err,holdings)=>{

        if(err){
            return res.send(err)
        }

        db.all(modelQuery,(err,model)=>{

            if(err){
                return res.send(err)
            }

            let total = 0

            holdings.forEach(h=>{
                total += h.current_value
            })

            let result = []
            let totalBuy = 0
            let totalSell = 0

            holdings.forEach(h=>{

                let currentPct = (h.current_value / total) * 100

                let modelFund = model.find(m => m.fund_id === h.fund_id)

                if(modelFund){

                    let target = modelFund.allocation_pct
                    let drift = target - currentPct
                    let amount = (drift/100) * total

                    let action = drift > 0 ? "BUY" : "SELL"

                    let amt = Math.abs(Math.round(amount))

                    if(action === "BUY"){
                        totalBuy += amt
                    }

                    if(action === "SELL"){
                        totalSell += amt
                    }

                    result.push({
                        fund: h.fund_name,
                        current_pct: currentPct.toFixed(2),
                        target_pct: target,
                        drift: drift.toFixed(2),
                        action: action,
                        amount: amt
                    })

                }
                else{

                    result.push({
                        fund: h.fund_name,
                        action: "REVIEW",
                        amount: h.current_value
                    })

                }

            })

            res.json({
                total_portfolio: total,
                total_buy: totalBuy,
                total_sell: totalSell,
                cash_needed: totalBuy - totalSell,
                rebalance: result
            })

        })

    })

})


// -----------------------------
// SERVER START
// -----------------------------

app.listen(3000,()=>{
    console.log("Server running on port 3000")
})