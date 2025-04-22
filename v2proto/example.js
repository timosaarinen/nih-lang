(function() {
    function mandelbrot(cx, cy) {
        let maxiters, py, n, zx, zy, px;
        let maxiters = 80;
        let zx = 0.0;
        let zy = 0.0;
        let n = 0;
        while ((n < maxiters)) {
            let px = ((zx * zx) - (zy * zy));
            let py = ((2 * zx) * zy);
            let zx = (px + cx);
            let zy = (py + cy);
            if ((Math.sqrt(((zx * zx) + (zy * zy))) > 2)) {
                return 0;
            }
            let n = (n + 1);
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
            console.log(((m > 0) ? "*" : " "));
        }
        console.log("\\n");
    }
})();