(function() {
    const stdlib = {
        print: function(s) { process.stdout.write(String(s)); },
        sqrt: Math.sqrt
    };
    let j;
    const WIDTH = 40;
    const HEIGHT = 20;
    const rs = -2.0;
    const re = 1.0;
    const is = -1.0;
    const ie = 1.0;
    function mandelbrot(cx, cy) {
        const maxiters = 80;
        let px, zx, n, zy, py;
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