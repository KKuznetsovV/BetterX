import './ContentGuidelinesModal.css'

interface ContentGuidelinesModalProps {
    onClose: () => void
}

export default function ContentGuidelinesModal({ onClose }: ContentGuidelinesModalProps) {
    return (
        <div className="content-guidelines-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="content-guidelines-modal" role="dialog" aria-modal="true" aria-label="Content Guidelines">
                <button type="button" className="content-guidelines-close" onClick={onClose} aria-label="Close">
                    x
                </button>
                <h2>Content Guidelines</h2>

                <h3>1. Objective and Scope</h3>
                <p>
                    The goal of the Profanity Preventer is to maintain a safe, welcoming, and inclusive environment without
                    completely stifling authentic user expression. These guidelines define what is blocked, what is filtered,
                    and how the system handles violations.
                </p>

                <h3>2. Tiered Enforcement Matrix</h3>
                <ul>
                    <li><strong>Tier 1:</strong> Slurs, hate speech, and severe harassment. Action: hard block.</li>
                    <li><strong>Tier 2:</strong> General profanity and vulgarity. Action: soft filter (context-dependent).</li>
                    <li><strong>Tier 3:</strong> False positives and slang. Action: allow.</li>
                </ul>

                <h3>3. Detailed Category Definitions</h3>
                <ul>
                    <li><strong>Tier 1 (Hard Block):</strong> Hate speech, explicit sexual threats, child exploitation references.</li>
                    <li><strong>Tier 2 (Filtered):</strong> Conversational swearing and vulgarity, with masking when needed.</li>
                    <li><strong>Tier 3 (Allowed):</strong> Reclaimed language, medical/anatomical context, and non-abusive art quotes.</li>
                </ul>

                <h3>4. Evasion and Bypass Detection Rules</h3>
                <ul>
                    <li>Leetspeak and character substitution.</li>
                    <li>Punctuation padding inside forbidden words.</li>
                    <li>Phonetic misspellings.</li>
                    <li>Emoji innuendo used to bypass filters.</li>
                </ul>

                <h3>5. User Transparency and Appeals</h3>
                <p>
                    If a submission violates guidelines, the user receives real-time feedback and can request a human review.
                </p>
                <h3>6. Prohibited Financial and Investment Content</h3>
                <p>
                    To protect users from financial harm, BetterX enforces zero tolerance for deceptive financial practices,
                    coordinated market manipulation, and unregulated investment schemes.
                </p>
                <ul>
                    <li><strong>Get-Rich-Quick and Pyramid Schemes:</strong> MLM, matrix schemes, or guaranteed unrealistic returns.</li>
                    <li><strong>Unlicensed Financial Advice:</strong> Direct buy/sell/hold directives without verified professional credentials.</li>
                    <li><strong>Pump-and-Dump Coordination:</strong> Coordinated attempts to inflate and dump asset prices.</li>
                </ul>

                <h3>7. Cryptocurrency and Digital Asset Policy</h3>
                <ul>
                    <li><strong>Prohibited:</strong> Unregulated token or NFT promotions, wallet-connect phishing airdrops, and fake deposit-doubling giveaways.</li>
                    <li><strong>Regulated:</strong> Educational Web3 discussions may be allowed but monitored for spam and abuse.</li>
                    <li><strong>System Action:</strong> High-frequency wallet-address and external-link posting can trigger temporary automated shadow moderation pending bot checks.</li>
                </ul>

                <h3>8. Medical and Health Advice Policy</h3>
                <p>
                    To reduce harm from health misinformation, BetterX prohibits unverified diagnoses, treatment plans,
                    and dangerous claims that can put users at physical risk.
                </p>
                <ul>
                    <li><strong>Prohibited:</strong> DIY diagnoses/dosages, anti-vaccine misinformation against major health-authority consensus, and toxic or extreme cure claims.</li>
                    <li><strong>Regulated:</strong> Personal health experience posts are allowed when contextual and non-prescriptive.</li>
                    <li><strong>System Action:</strong> For treatment/condition discussions, BetterX may append a standard medical community note.</li>
                </ul>
            </div>
        </div>
    )
}
