'use client';

import { useState } from 'react';

interface IndicatorSection {
  id: string;
  title: string;
  icon: string;
  category: 'technical' | 'quant' | 'sentiment';
  shortDesc: string;
  whatIsIt: string;
  howToRead: {
    bullish: string[];
    bearish: string[];
    neutral?: string[];
  };
  realWorldAnalogy: string;
  proTips: string[];
  commonMistakes: string[];
  formula?: string;
}

const indicators: IndicatorSection[] = [
  // TECHNICAL INDICATORS
  {
    id: 'price',
    title: 'Price Action',
    icon: '💰',
    category: 'technical',
    shortDesc: 'The raw movement of price over time - the foundation of all analysis.',
    whatIsIt: `Price action is simply watching how the price moves up and down over time. Think of it as reading the story of what buyers and sellers are doing. When price goes up, buyers are winning. When it goes down, sellers are winning. It's the most basic but most important thing to watch.`,
    howToRead: {
      bullish: [
        'Price making higher highs AND higher lows (like climbing stairs up)',
        'Strong green candles with small wicks (confident buyers)',
        'Price bouncing off support levels multiple times',
        'Breaking above previous resistance with volume',
      ],
      bearish: [
        'Price making lower highs AND lower lows (like walking down stairs)',
        'Strong red candles with small wicks (confident sellers)',
        'Price failing to break above resistance multiple times',
        'Breaking below support levels with volume',
      ],
    },
    realWorldAnalogy: `Imagine you're at an auction. When lots of people want something, they keep bidding higher (price goes up). When nobody wants it, the seller has to keep lowering the price to find a buyer. Price action tells you who's winning the tug-of-war between buyers and sellers.`,
    proTips: [
      'Always look at price first before any indicator',
      'Higher timeframes (daily, weekly) are more reliable than lower ones',
      'Price near round numbers ($50,000, $100,000) often acts as support/resistance',
    ],
    commonMistakes: [
      'Ignoring the overall trend and focusing on tiny moves',
      'Not considering volume alongside price',
      'Trading against the trend expecting a reversal',
    ],
  },
  {
    id: 'ema',
    title: 'EMA (Exponential Moving Average)',
    icon: '📈',
    category: 'technical',
    shortDesc: 'A smoothed line showing average price, with more weight on recent prices.',
    whatIsIt: `An EMA is like a "smoothed out" version of the price. Instead of seeing every tiny up and down, it shows you the general direction. The "exponential" part means it cares more about recent prices than old ones - so it reacts faster to new changes. Common periods are 20 (short-term), 50 (medium-term), 100 and 200 (long-term).`,
    howToRead: {
      bullish: [
        'Price is ABOVE the EMA (price is stronger than average)',
        'Shorter EMA crosses ABOVE longer EMA ("Golden Cross" - very bullish!)',
        'EMAs are stacked in order: price > EMA20 > EMA50 > EMA100 > EMA200',
        'Price pulls back to EMA and bounces up (EMA acting as support)',
      ],
      bearish: [
        'Price is BELOW the EMA (price is weaker than average)',
        'Shorter EMA crosses BELOW longer EMA ("Death Cross" - very bearish!)',
        'EMAs are stacked in reverse: price < EMA20 < EMA50 < EMA100 < EMA200',
        'Price bounces down from EMA (EMA acting as resistance)',
      ],
    },
    realWorldAnalogy: `Think of EMA like your GPA in school. Your GPA doesn't jump around with every single test - it's a smoothed average. But recent tests matter more than tests from freshman year. If your current grades are above your GPA, you're improving (bullish). If below, you're slipping (bearish).`,
    proTips: [
      'EMA 200 is watched by millions - it\'s a self-fulfilling prophecy',
      'Use faster EMAs (20, 50) for entries, slower EMAs (100, 200) for trend direction',
      'The space between EMAs shows trend strength - wider = stronger trend',
    ],
    commonMistakes: [
      'Using EMAs alone without price context',
      'Expecting EMAs to work in choppy, sideways markets',
      'Not adjusting EMA periods for different timeframes',
    ],
    formula: 'EMA = (Price × k) + (Previous EMA × (1 - k)), where k = 2/(N+1)',
  },
  {
    id: 'rsi',
    title: 'RSI (Relative Strength Index)',
    icon: '💪',
    category: 'technical',
    shortDesc: 'Measures if an asset is overbought (too expensive) or oversold (too cheap).',
    whatIsIt: `RSI is like a speedometer for price momentum, ranging from 0 to 100. It measures how fast and how much the price has been going up vs going down recently. Above 70 means "overbought" (price went up too fast, might need a rest). Below 30 means "oversold" (price went down too fast, might bounce). It doesn't tell you WHEN to buy/sell, but warns you when conditions are extreme.`,
    howToRead: {
      bullish: [
        'RSI bounces UP from below 30 (oversold bounce)',
        'RSI breaks above 50 from below (momentum shifting to buyers)',
        'RSI makes higher lows while price makes lower lows (bullish divergence - powerful!)',
        'RSI stays in 40-80 range during uptrends',
      ],
      bearish: [
        'RSI drops DOWN from above 70 (overbought rejection)',
        'RSI breaks below 50 from above (momentum shifting to sellers)',
        'RSI makes lower highs while price makes higher highs (bearish divergence - warning!)',
        'RSI stays in 20-60 range during downtrends',
      ],
    },
    realWorldAnalogy: `Imagine you're running uphill. RSI measures how tired you're getting. At RSI 70+, you're sprinting - you can't maintain that pace forever and will need to slow down. At RSI 30-, you're exhausted and crawling - you'll probably catch your breath soon. It doesn't mean you'll definitely stop, just that you're reaching your limits.`,
    proTips: [
      'In strong trends, RSI can stay overbought/oversold for a LONG time',
      'Divergences (RSI vs Price disagreeing) are the most powerful RSI signals',
      'RSI 50 is the "equator" - above = bullish control, below = bearish control',
    ],
    commonMistakes: [
      'Selling just because RSI hit 70 (it can stay overbought in bull markets)',
      'Buying just because RSI hit 30 (it can stay oversold in bear markets)',
      'Ignoring divergences - they\'re more important than levels',
    ],
    formula: 'RSI = 100 - (100 / (1 + RS)), where RS = Avg Gain / Avg Loss',
  },
  {
    id: 'macd',
    title: 'MACD (Moving Average Convergence Divergence)',
    icon: '📊',
    category: 'technical',
    shortDesc: 'Shows momentum by comparing two moving averages - tells you if momentum is growing or fading.',
    whatIsIt: `MACD has three parts: the MACD line (difference between fast and slow EMAs), the Signal line (smoothed MACD), and the Histogram (difference between them). Think of it as measuring the "acceleration" of price. It tells you not just which direction price is going, but whether it's speeding up or slowing down.`,
    howToRead: {
      bullish: [
        'MACD line crosses ABOVE signal line (buy signal)',
        'Histogram bars turning from red to green (momentum shifting)',
        'Histogram bars growing taller and green (accelerating upward)',
        'Both lines are above zero (overall bullish momentum)',
        'MACD making higher lows while price makes lower lows (bullish divergence)',
      ],
      bearish: [
        'MACD line crosses BELOW signal line (sell signal)',
        'Histogram bars turning from green to red (momentum shifting)',
        'Histogram bars growing taller and red (accelerating downward)',
        'Both lines are below zero (overall bearish momentum)',
        'MACD making lower highs while price makes higher highs (bearish divergence)',
      ],
    },
    realWorldAnalogy: `Think of MACD like your car's acceleration. The MACD line is your current speed, the Signal line is your average speed. When your current speed crosses above your average, you're accelerating (bullish). The histogram shows HOW FAST you're accelerating - tall bars mean you're really stepping on the gas.`,
    proTips: [
      'MACD crossovers work best when they happen far from zero line',
      'Zero line crossovers are bigger deals than signal crossovers',
      'Histogram shrinking = momentum fading, even if still in the same direction',
    ],
    commonMistakes: [
      'Taking every crossover as a trade signal (causes overtrading)',
      'Ignoring the distance from zero line (weak signals near zero)',
      'Not waiting for confirmation from price action',
    ],
    formula: 'MACD = EMA(12) - EMA(26), Signal = EMA(9) of MACD',
  },
  {
    id: 'bbands',
    title: 'Bollinger Bands',
    icon: '🎸',
    category: 'technical',
    shortDesc: 'Dynamic bands that expand and contract based on volatility - shows if price is "normal" or extreme.',
    whatIsIt: `Bollinger Bands are like a rubber band around price. There's a middle line (20-period average), and upper/lower bands that are 2 standard deviations away. When volatility is high, bands spread apart. When volatility is low, bands squeeze together. Price touching the bands doesn't mean buy/sell - it means price is at an extreme.`,
    howToRead: {
      bullish: [
        'Price "walks the bands" along upper band (strong uptrend)',
        'Price bounces off lower band with increasing volume',
        'Bands squeezing tight then price breaks UPWARD (volatility breakout)',
        'Price closes outside lower band then immediately back inside (reversal signal)',
      ],
      bearish: [
        'Price "walks the bands" along lower band (strong downtrend)',
        'Price rejects from upper band with increasing volume',
        'Bands squeezing tight then price breaks DOWNWARD',
        'Price closes outside upper band then immediately back inside (reversal signal)',
      ],
    },
    realWorldAnalogy: `Imagine price is a bouncy ball in a hallway. The Bollinger Bands are the walls. Usually, the ball bounces between walls. But sometimes the ball hits a wall so hard it breaks through. When the hallway narrows (squeeze), something explosive is about to happen - the ball is being compressed and will burst out.`,
    proTips: [
      'The "squeeze" (narrow bands) predicts big moves, but NOT the direction',
      'In trends, price can "ride" the bands for extended periods',
      'Combine with RSI: price at lower band + RSI oversold = stronger signal',
    ],
    commonMistakes: [
      'Automatically selling when price hits upper band (it can ride it)',
      'Expecting price to return to middle band immediately',
      'Ignoring the squeeze - it\'s the most important signal',
    ],
    formula: 'Upper = SMA(20) + 2×StdDev, Lower = SMA(20) - 2×StdDev',
  },
  {
    id: 'volume',
    title: 'Volume',
    icon: '📢',
    category: 'technical',
    shortDesc: 'The number of shares/coins traded - shows the conviction behind price moves.',
    whatIsIt: `Volume is simply how much was traded. Think of it as the "loudness" of the market's opinion. A price move with high volume is like everyone shouting their agreement. A price move with low volume is like a few people whispering - it might not stick. Volume confirms or denies what price is telling you.`,
    howToRead: {
      bullish: [
        'Price UP + Volume UP = Strong buying (healthy rally)',
        'Price down + Volume DOWN = Weak selling (pullback, not reversal)',
        'Volume spike on breakout above resistance (confirming breakout)',
        'Each rally has higher volume than previous rally',
      ],
      bearish: [
        'Price DOWN + Volume UP = Strong selling (concerning drop)',
        'Price up + Volume DOWN = Weak buying (rally running out of steam)',
        'Volume spike on breakdown below support (confirming breakdown)',
        'Each drop has higher volume than previous drop',
      ],
    },
    realWorldAnalogy: `Volume is like the crowd at a protest. If millions march, politicians pay attention (high volume = significant). If only a few people show up, nothing changes (low volume = ignorable). The bigger the crowd behind a move, the more likely it is to matter and continue.`,
    proTips: [
      'Volume precedes price - unusual volume often comes before big moves',
      'Compare volume to average, not just recent bars',
      'Breakouts without volume often fail (false breakouts)',
    ],
    commonMistakes: [
      'Ignoring volume entirely (many traders do this)',
      'Not looking at volume relative to average',
      'Treating all volume the same regardless of price action',
    ],
  },

  // QUANT INDICATORS
  {
    id: 'atr',
    title: 'ATR (Average True Range)',
    icon: '📏',
    category: 'quant',
    shortDesc: 'Measures volatility - how much price typically moves in a day.',
    whatIsIt: `ATR tells you the "typical daily range" of price movement. If ATR is $1,000, the asset typically moves about $1,000 per day. It doesn't tell you direction - just how wild or calm the ride will be. Higher ATR = more volatile (bigger swings), Lower ATR = calmer (smaller swings). It's crucial for setting stop losses and position sizing.`,
    howToRead: {
      bullish: [
        'ATR decreasing during consolidation, then price breaks UP (calm before the storm)',
        'ATR expanding while price trends up (healthy trend with participation)',
      ],
      bearish: [
        'ATR decreasing during consolidation, then price breaks DOWN',
        'ATR spiking dramatically (often during panic selloffs)',
        'ATR expanding while price trends down (fear increasing)',
      ],
      neutral: [
        'ATR itself isn\'t bullish/bearish - it just measures movement size',
        'Use it to size positions and set appropriate stop losses',
      ],
    },
    realWorldAnalogy: `ATR is like checking the weather before dressing. If ATR is high, expect wild swings - dress for a storm (wider stops, smaller position). If ATR is low, expect calm - you can take more precise positions. You wouldn't wear the same outfit for a hurricane and a sunny day.`,
    proTips: [
      'Set stop losses as a multiple of ATR (e.g., 2x ATR below entry)',
      'Lower ATR periods often precede explosive moves',
      'Size positions inversely to ATR - more volatile = smaller position',
    ],
    commonMistakes: [
      'Using fixed dollar stops instead of ATR-based stops',
      'Not adjusting position size when ATR changes',
      'Confusing ATR direction with price direction',
    ],
    formula: 'ATR = Average of True Range over N periods, TR = max(H-L, |H-Prev Close|, |L-Prev Close|)',
  },
  {
    id: 'adx',
    title: 'ADX (Average Directional Index)',
    icon: '🎯',
    category: 'quant',
    shortDesc: 'Measures trend STRENGTH (not direction) - tells you if a trend is strong or weak.',
    whatIsIt: `ADX answers one simple question: "Is there a trend, and how strong is it?" It ranges from 0-100. It does NOT tell you if the trend is up or down - just how strong it is. Below 20 = weak/no trend (choppy, ranging market). Above 40 = strong trend. This helps you decide whether to use trend-following or range-trading strategies.`,
    howToRead: {
      bullish: [
        'ADX rising above 25 while price is rising (confirmed uptrend developing)',
        'ADX above 40 with higher prices (strong bullish trend - ride it!)',
      ],
      bearish: [
        'ADX rising above 25 while price is falling (confirmed downtrend developing)',
        'ADX above 40 with lower prices (strong bearish trend)',
      ],
      neutral: [
        'ADX below 20 = ranging market, no clear trend (use range strategies)',
        'ADX declining from high levels = trend weakening, prepare for change',
      ],
    },
    realWorldAnalogy: `ADX is like a wind speed meter. It tells you how hard the wind is blowing, not which direction. If ADX is 50 (hurricane force), don't fight the trend - you'll get blown away. If ADX is 15 (light breeze), the market is calm and could go either way. Strong wind = respect it. No wind = be flexible.`,
    proTips: [
      'ADX below 20 = avoid trend strategies, use mean-reversion',
      'ADX above 40 = strong trend, don\'t try to pick tops/bottoms',
      'Falling ADX from high levels = take profits on trend trades',
    ],
    commonMistakes: [
      'Thinking high ADX means bullish (it just means strong trend, could be down)',
      'Trading trends when ADX is below 20 (you\'ll get chopped up)',
      'Ignoring ADX direction changes',
    ],
    formula: 'ADX = Smoothed average of the Directional Movement Index (DX)',
  },
  {
    id: 'obv',
    title: 'OBV (On-Balance Volume)',
    icon: '⚖️',
    category: 'quant',
    shortDesc: 'Cumulative volume that shows if big players are accumulating or distributing.',
    whatIsIt: `OBV tracks the running total of volume, adding it on up days and subtracting it on down days. The actual number doesn't matter - what matters is the DIRECTION. If OBV is rising, more volume is flowing in on up days (accumulation). If OBV is falling, more volume is flowing out on down days (distribution). It often leads price.`,
    howToRead: {
      bullish: [
        'OBV making new highs before price (smart money buying)',
        'OBV trending up while price goes sideways (accumulation phase)',
        'OBV confirming price highs (healthy uptrend)',
      ],
      bearish: [
        'OBV making new lows before price (smart money selling)',
        'OBV trending down while price goes sideways (distribution phase)',
        'OBV diverging down while price makes new highs (warning sign!)',
      ],
    },
    realWorldAnalogy: `Imagine a bucket with water flowing in and out. OBV measures whether more water is flowing IN (accumulation) or OUT (distribution) over time. If the bucket level keeps rising even when some water splashes out, buying pressure is winning. The bucket level often predicts whether the sink will overflow (price rally) or dry up (price drop).`,
    proTips: [
      'OBV divergences are powerful - trust OBV over price when they disagree',
      'OBV leading price is the best signal (accumulation/distribution)',
      'Flat OBV with rising price = weak rally, likely to fail',
    ],
    commonMistakes: [
      'Focusing on the absolute OBV number (only direction matters)',
      'Ignoring OBV divergences from price',
      'Not looking at OBV during consolidations',
    ],
    formula: 'OBV = Previous OBV + Volume (if close > prev close) or - Volume (if close < prev close)',
  },
  {
    id: 'sharpe',
    title: 'Sharpe Ratio',
    icon: '⚡',
    category: 'quant',
    shortDesc: 'Risk-adjusted returns - measures how much return you get per unit of risk.',
    whatIsIt: `The Sharpe Ratio asks: "Is the return worth the risk?" A Sharpe of 1 means you're getting 1% extra return for each 1% of risk you take. Higher is better. Above 1 = good, Above 2 = excellent, Above 3 = exceptional. Negative means you're losing money. It helps you compare investments fairly - a 50% return with massive volatility might be worse than 20% with low volatility.`,
    howToRead: {
      bullish: [
        'Sharpe above 2 (excellent risk-adjusted returns)',
        'Sharpe improving over time (getting better returns for same risk)',
      ],
      bearish: [
        'Sharpe below 0 (losing money)',
        'Sharpe declining (returns getting worse relative to risk)',
        'Sharpe between 0-0.5 (barely worth the risk)',
      ],
    },
    realWorldAnalogy: `Imagine two job offers. Job A pays $200K but you work 100 hours/week in a dangerous coal mine. Job B pays $100K but you work 40 hours/week from home. Sharpe Ratio is like calculating "pay per hour adjusted for misery." Job B might have a higher "Sharpe" because the return (pay) relative to risk (stress/danger) is better.`,
    proTips: [
      'Compare Sharpe ratios of different assets to find best risk-adjusted returns',
      'A lower-return asset with high Sharpe might be better than high-return low Sharpe',
      'Sharpe can be improved by reducing volatility OR increasing returns',
    ],
    commonMistakes: [
      'Only looking at returns without considering risk',
      'Comparing Sharpe ratios across different time periods',
      'Ignoring that past Sharpe doesn\'t guarantee future Sharpe',
    ],
    formula: 'Sharpe = (Return - Risk-Free Rate) / Standard Deviation of Returns',
  },
  {
    id: 'regime',
    title: 'Market Regime',
    icon: '🌤️',
    category: 'quant',
    shortDesc: 'Classifies the current market "weather" - trending, ranging, or volatile.',
    whatIsIt: `Market regime classification tells you what "mode" the market is in. Like weather, markets have different seasons: Bull (sunny uptrend), Bear (stormy downtrend), Ranging (calm sideways), or Volatile Chop (unpredictable). Different strategies work in different regimes - you wouldn't use a trend strategy in a ranging market.`,
    howToRead: {
      bullish: [
        'Regime = "Bullish" (uptrend with strong ADX, positive returns)',
        'Regime shifting from Ranging to Bullish (new uptrend starting)',
      ],
      bearish: [
        'Regime = "Bearish" (downtrend with strong ADX, negative returns)',
        'Regime shifting from Bullish to Bearish (trend reversing)',
      ],
      neutral: [
        'Regime = "Ranging" (weak ADX, low volatility - trade ranges)',
        'Regime = "Volatile Chop" (weak ADX, high volatility - stay out!)',
      ],
    },
    realWorldAnalogy: `Market regime is like checking if it's beach weather or ski weather before picking your outfit. In "Bullish" regime, wear your trend-following hat. In "Ranging" regime, use your buy-low-sell-high strategy. In "Volatile Chop," maybe just stay inside - it's dangerous out there.`,
    proTips: [
      'Match your strategy to the regime - don\'t fight the market weather',
      'Regime changes are gradual - probabilities shift before labels change',
      'Volatile Chop regimes destroy most strategies - reduce size or sit out',
    ],
    commonMistakes: [
      'Using trend strategies in ranging markets',
      'Using range strategies in trending markets',
      'Not adapting when regime changes',
    ],
  },

  // SENTIMENT INDICATORS
  {
    id: 'sentiment',
    title: 'News Sentiment',
    icon: '📰',
    category: 'sentiment',
    shortDesc: 'Measures the overall mood from news - are headlines positive or negative?',
    whatIsIt: `News sentiment uses AI to analyze recent news and social media, scoring them from very negative to very positive. High positive sentiment = lots of good news and optimism. High negative sentiment = bad news and fear. It's a contrarian indicator - extreme sentiment often signals reversals because when everyone is bullish, there's no one left to buy.`,
    howToRead: {
      bullish: [
        'Sentiment extremely negative (everyone is scared = potential bottom)',
        'Sentiment improving from negative (fear turning to hope)',
        'Neutral sentiment during uptrend (not euphoric = room to grow)',
      ],
      bearish: [
        'Sentiment extremely positive (everyone is greedy = potential top)',
        'Sentiment declining from positive (hope turning to fear)',
        'Super bullish sentiment + price stalling (euphoria = danger)',
      ],
    },
    realWorldAnalogy: `When everyone at the party is talking about crypto gains, it's probably near a top - all the buyers have already bought. When everyone is saying crypto is dead, it's probably near a bottom - all the sellers have already sold. Warren Buffett: "Be fearful when others are greedy, and greedy when others are fearful."`,
    proTips: [
      'Extreme sentiment is a contrarian indicator',
      'Sentiment works best at extremes, less useful in the middle',
      'Combine with price action - don\'t trade sentiment alone',
    ],
    commonMistakes: [
      'Buying because news is good (you\'re late)',
      'Selling because news is bad (you might be early to the recovery)',
      'Reacting to every news headline',
    ],
  },
];

const categoryInfo = {
  technical: { label: 'Technical Analysis', color: 'cyan', icon: '📊' },
  quant: { label: 'Quantitative Finance', color: 'purple', icon: '📈' },
  sentiment: { label: 'Sentiment Analysis', color: 'green', icon: '💬' },
};

export default function LearnPage() {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'technical' | 'quant' | 'sentiment'>('all');
  const [expandedId, setExpandedId] = useState<string | null>('price');

  const filteredIndicators = selectedCategory === 'all' 
    ? indicators 
    : indicators.filter(ind => ind.category === selectedCategory);

  return (
    <div className="min-h-screen grid-pattern">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12 fade-in">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full mb-4">
            <span className="text-2xl">🤔</span>
            <span className="text-yellow-400 font-medium">Beginner Friendly Guide</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">
            <span className="neon-text-cyan">&quot;I Don&apos;t Understand</span>{' '}
            <span className="neon-text-purple">A Thing&quot;</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Don&apos;t worry! Every pro trader started as a confused beginner. This guide explains each indicator 
            in plain English with real-world analogies. No math degree required. 🎓
          </p>
        </div>

        {/* Quick Tips Banner */}
        <div className="neon-card p-6 mb-8 fade-in-delay-1">
          <h2 className="text-lg font-semibold text-gray-200 mb-3 flex items-center gap-2">
            <span>💡</span> Before You Start: The Golden Rules
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <p className="text-cyan-400 font-medium mb-1">Rule #1</p>
              <p className="text-sm text-gray-400">No indicator works 100% of the time. They&apos;re tools, not crystal balls.</p>
            </div>
            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <p className="text-purple-400 font-medium mb-1">Rule #2</p>
              <p className="text-sm text-gray-400">Always use multiple indicators together. They&apos;re stronger as a team.</p>
            </div>
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-green-400 font-medium mb-1">Rule #3</p>
              <p className="text-sm text-gray-400">Price is king. If indicators disagree with price, trust price.</p>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-3 mb-8 fade-in-delay-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedCategory === 'all'
                ? 'bg-gray-700 text-white'
                : 'bg-[#1e293b] text-gray-400 hover:text-gray-200'
            }`}
          >
            📚 All Indicators
          </button>
          {Object.entries(categoryInfo).map(([key, info]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key as 'technical' | 'quant' | 'sentiment')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedCategory === key
                  ? `bg-${info.color}-500/20 text-${info.color}-400 border border-${info.color}-500/50`
                  : 'bg-[#1e293b] text-gray-400 hover:text-gray-200'
              }`}
              style={{
                backgroundColor: selectedCategory === key ? `var(--${info.color}-bg, rgba(0,200,200,0.1))` : undefined,
                color: selectedCategory === key ? `var(--${info.color}-text, #22d3ee)` : undefined,
              }}
            >
              {info.icon} {info.label}
            </button>
          ))}
        </div>

        {/* Indicators List */}
        <div className="space-y-4 fade-in-delay-3">
          {filteredIndicators.map((indicator) => (
            <div key={indicator.id} className="neon-card overflow-hidden">
              {/* Header - Always visible */}
              <button
                onClick={() => setExpandedId(expandedId === indicator.id ? null : indicator.id)}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-[#1e293b]/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{indicator.icon}</span>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-200">{indicator.title}</h3>
                    <p className="text-sm text-gray-400">{indicator.shortDesc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    indicator.category === 'technical' ? 'bg-cyan-500/20 text-cyan-400' :
                    indicator.category === 'quant' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {categoryInfo[indicator.category].label}
                  </span>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${expandedId === indicator.id ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded Content */}
              {expandedId === indicator.id && (
                <div className="px-6 pb-6 border-t border-[#1e293b]">
                  {/* What is it */}
                  <div className="mt-6">
                    <h4 className="text-lg font-semibold text-gray-200 mb-3 flex items-center gap-2">
                      <span>🎯</span> What is it?
                    </h4>
                    <p className="text-gray-300 leading-relaxed">{indicator.whatIsIt}</p>
                  </div>

                  {/* Real World Analogy */}
                  <div className="mt-6 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                    <h4 className="text-lg font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                      <span>🌍</span> Real World Analogy
                    </h4>
                    <p className="text-gray-300 leading-relaxed">{indicator.realWorldAnalogy}</p>
                  </div>

                  {/* How to Read */}
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bullish */}
                    <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
                      <h4 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                        <span>🐂</span> Bullish Signals (Buy/Long)
                      </h4>
                      <ul className="space-y-2">
                        {indicator.howToRead.bullish.map((signal, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                            <span className="text-green-400 mt-1">✓</span>
                            {signal}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Bearish */}
                    <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                      <h4 className="text-lg font-semibold text-red-400 mb-3 flex items-center gap-2">
                        <span>🐻</span> Bearish Signals (Sell/Short)
                      </h4>
                      <ul className="space-y-2">
                        {indicator.howToRead.bearish.map((signal, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                            <span className="text-red-400 mt-1">✗</span>
                            {signal}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Neutral signals if exists */}
                  {indicator.howToRead.neutral && (
                    <div className="mt-4 p-4 bg-gray-500/5 border border-gray-500/20 rounded-lg">
                      <h4 className="text-lg font-semibold text-gray-400 mb-3 flex items-center gap-2">
                        <span>⚖️</span> Neutral / Important Notes
                      </h4>
                      <ul className="space-y-2">
                        {indicator.howToRead.neutral.map((signal, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                            <span className="text-gray-400 mt-1">•</span>
                            {signal}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Pro Tips & Common Mistakes */}
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Pro Tips */}
                    <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
                      <h4 className="text-lg font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                        <span>💎</span> Pro Tips
                      </h4>
                      <ul className="space-y-2">
                        {indicator.proTips.map((tip, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                            <span className="text-cyan-400 mt-1">→</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Common Mistakes */}
                    <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                      <h4 className="text-lg font-semibold text-orange-400 mb-3 flex items-center gap-2">
                        <span>⚠️</span> Common Mistakes
                      </h4>
                      <ul className="space-y-2">
                        {indicator.commonMistakes.map((mistake, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                            <span className="text-orange-400 mt-1">!</span>
                            {mistake}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Formula (if exists) */}
                  {indicator.formula && (
                    <div className="mt-6 p-4 bg-[#1e293b]/50 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2">
                        <span>📐</span> Formula (for the nerds 🤓)
                      </h4>
                      <code className="text-sm text-purple-400 font-mono">{indicator.formula}</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center fade-in-delay-3">
          <div className="neon-card p-8">
            <h2 className="text-2xl font-bold text-gray-200 mb-4">Ready to Put This Knowledge to Use? 🚀</h2>
            <p className="text-gray-400 mb-6">
              Now that you understand the indicators, head to the analysis pages and see them in action!
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="/technical"
                className="px-6 py-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400 hover:bg-cyan-500/20 transition-all"
              >
                📊 Technical Analysis
              </a>
              <a
                href="/quant"
                className="px-6 py-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-400 hover:bg-purple-500/20 transition-all"
              >
                📈 Quant Finance
              </a>
              <a
                href="/sentiment"
                className="px-6 py-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 hover:bg-green-500/20 transition-all"
              >
                💬 Sentiment
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
