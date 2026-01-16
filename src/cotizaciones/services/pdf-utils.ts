
/**
 * Formatea moneda
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
};

/**
 * Formatea fecha corta dd-mm-aaaa
 */
export const formatDateShort = (date: string | Date | undefined): string => {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  // Ajustar zona horaria si es necesario o usar UTC methods
  const day = d.getUTCDate().toString().padStart(2, '0');
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
};
