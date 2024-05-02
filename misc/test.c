// simple snippets for reference
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>

typedef uint8_t  u8;
typedef uint16_t u16;
typedef uint32_t u32;
typedef int8_t   s8;
typedef int16_t  s16;
typedef int32_t  s32;

// unorthodox main
void main() {
  s8 sbyte = -1; // 0xFF
  u8 ubyte = 0xFF;
  s8 sshiftedbyone = sbyte >> 1;
  u8 ushiftedbyone = ubyte >> 1;
  printf("s8(0x%hhx) >> 1 == 0x%hhx\n", sbyte, sshiftedbyone);
  printf("u8(0x%hhx) >> 1 == 0x%hhx\n", ubyte, ushiftedbyone);
}
