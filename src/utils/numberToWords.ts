const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
  'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function menorQueMil(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  if (n < 20) return unidades[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`;
  }
  const c = Math.floor(n / 100);
  const resto = n % 100;
  return resto === 0 ? centenas[c] : `${centenas[c]} e ${menorQueMil(resto)}`;
}

export function extensoSimples(n: number): string {
  if (n === 0) return 'zero';
  if (n === 1) return 'um';
  if (n < 1000) return menorQueMil(n);
  if (n < 1000000) {
    const mil = Math.floor(n / 1000);
    const resto = n % 1000;
    const milStr = mil === 1 ? 'mil' : `${menorQueMil(mil)} mil`;
    return resto === 0 ? milStr : `${milStr} e ${menorQueMil(resto)}`;
  }
  return n.toString();
}

export function extenso(valor: number): string {
  if (valor === 0) return 'zero reais';
  const inteiro = Math.floor(valor);
  const centavos = Math.round((valor - inteiro) * 100);

  let resultado = '';
  if (inteiro > 0) {
    resultado += extensoSimples(inteiro);
    resultado += inteiro === 1 ? ' real' : ' reais';
  }
  if (centavos > 0) {
    if (inteiro > 0) resultado += ' e ';
    resultado += extensoSimples(centavos);
    resultado += centavos === 1 ? ' centavo' : ' centavos';
  }
  return resultado;
}
