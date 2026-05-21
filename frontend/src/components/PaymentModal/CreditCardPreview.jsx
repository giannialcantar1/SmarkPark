import styles from './PaymentModal.module.css'

function getBrandLabel(brand) {
  if (brand === 'visa') return 'VISA'
  if (brand === 'mastercard') return 'MASTERCARD'
  if (brand === 'amex') return 'AMEX'
  return 'SMARTPAY'
}

function getMaskedNumber(number) {
  if (number) return number
  return '•••• •••• •••• ••••'
}

export default function CreditCardPreview({ cardData, brand = 'unknown', style = null }) {
  const holder = String(cardData?.holder || '').trim() || 'NOMBRE DEL TITULAR'
  const expiry = String(cardData?.expiry || '').trim() || 'MM/AA'
  const number = getMaskedNumber(cardData?.number)

  return (
    <div className={`${styles.creditCard} ${styles[`creditCard${brand}`] || ''}`} style={style || undefined}>
      <div className={styles.creditCardGlow} />
      <div className={styles.creditCardTop}>
        <div className={styles.creditCardChip} aria-hidden="true">
          <span className={styles.creditCardChipLine} />
          <span className={styles.creditCardChipLine} />
        </div>
        <div className={styles.creditCardBrand}>
          <span className={styles.creditCardBrandDot} />
          <span>{getBrandLabel(brand)}</span>
        </div>
      </div>

      <div className={styles.creditCardNumber}>{number}</div>

      <div className={styles.creditCardFooter}>
        <div className={styles.creditCardMeta}>
          <span className={styles.creditCardMetaLabel}>Titular</span>
          <span className={styles.creditCardMetaValue}>{holder}</span>
        </div>
        <div className={styles.creditCardMeta}>
          <span className={styles.creditCardMetaLabel}>Expira</span>
          <span className={styles.creditCardMetaValue}>{expiry}</span>
        </div>
      </div>
    </div>
  )
}
