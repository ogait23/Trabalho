document.addEventListener("DOMContentLoaded", function () {
    var precoElemento = document.getElementById("preco-estimado");
    if (!precoElemento) {
        return;
    }

    var precoBase = parseFloat(precoElemento.dataset.precoBase);
    var selectTamanho = document.getElementById("tamanho_id");
    var selectSegundoSabor = document.getElementById("segundo_sabor_id");
    var inputQuantidade = document.getElementById("quantidade");

    function atualizarPreco() {
        var precoSabor = precoBase;

        if (selectSegundoSabor) {
            var opcaoSabor = selectSegundoSabor.options[selectSegundoSabor.selectedIndex];
            var precoSegundoSabor = parseFloat(opcaoSabor.dataset.preco || "0");
            if (precoSegundoSabor > precoSabor) {
                precoSabor = precoSegundoSabor;
            }
        }

        var adicionalTamanho = 0;
        if (selectTamanho) {
            var opcaoTamanho = selectTamanho.options[selectTamanho.selectedIndex];
            adicionalTamanho = parseFloat(opcaoTamanho.dataset.adicional || "0");
        }

        var quantidade = parseInt(inputQuantidade.value || "1", 10);
        var total = (precoSabor + adicionalTamanho) * quantidade;

        precoElemento.textContent = "Preço estimado: R$ " + total.toFixed(2);
    }

    if (selectTamanho) {
        selectTamanho.addEventListener("change", atualizarPreco);
    }
    if (selectSegundoSabor) {
        selectSegundoSabor.addEventListener("change", atualizarPreco);
    }
    inputQuantidade.addEventListener("input", atualizarPreco);

    atualizarPreco();
});
