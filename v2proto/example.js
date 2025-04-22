(function() {
    const stdlib = {
        print: function(s) { process.stdout.write(String(s)); },
        sqrt: Math.sqrt
    };
    function mandelbrot(cx, cy) {
        let px, zx, py, n, maxiters, zy;
        maxiters = 80;
        zx = 0.0;
        zy = 0.0;
        n = 0;
        while ((n < maxiters)) {
            px = ((zx * zx) - (zy * zy));
            py = ((2 * zx) * zy);
            zx = (px + cx);
            zy = (py + cy);
            if ((stdlib.sqrt(((zx * zx) + (zy * zy))) > 2)) {
                return 0;
            }
            n = (n + 1);
        }
        return n;
    }
    let WIDTH = 40;
    let HEIGHT = 20;
    let rs = -2.0;
    let re = 1.0;
    let is = -1.0;
    let ie = 1.0;
    for (let j = 0; j <= (HEIGHT - 1); j++) {
        for (let i = 0; i <= (WIDTH - 1); i++) {
            let cx = (rs + ((i / (WIDTH - 1)) * (re - rs)));
            let cy = (is + ((j / (HEIGHT - 1)) * (ie - is)));
            let m = mandelbrot(cx, cy);
            stdlib.print(((m > 0) ? "*" : " "));
        }
        stdlib.print("\n");
    }
})();