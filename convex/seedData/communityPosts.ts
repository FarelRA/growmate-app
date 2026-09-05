// Auto-generated seed data for community posts — do not edit manually

interface SeedCommunityPost {
  userIndex: number
  title: string
  body: string
  image?: {
    hash: string
    sizes: Record<string, string>
  }
}

const SHARED_POST_IMAGE = {
  hash: "a1b2c3d4e5f67890",
  sizes: {
    "50w": "data:image/webp;base64,UklGRnYBAABXRUJQVlA4IGoBAACwCACdASoyABwAPmkskkWkIqGWDVcwQAaEsQBYj9TbIMiv+W3geHqp0jALZtYLXE/cNplnhJ4n50EIBqbc1TuXNODvBXYq+/DB8wduBwAA/soHPQ2/uQxe50bSgO/Fe7HOBodMhuGvzkke1lOpIBoqJhJuXWbC51p0suyv6JDmQffkGacITKNeHQbDZXlPt8sxwDdc2KnLJgnr7aLicLOS6LrY2bwanhk4JD1/ykxsNxDaeGHHClojfQ0xWCvx4Tq2c61o8CohToXZGHDpJt1o6X8B9kE4D5HwPCyh05/64md5/kWDJvAqpwVoIrCxBOWGbX1mmZoZTc3+YgmcYuGYygjHdJ+hpiJCJ7i/v6UNX2RpZS+M5lBhhJ0JQRomUzq96tXKK8aVQiDmuxobr2H4HFi34m0SZFpEc0DrhlXgptpRFERVig4nZgYOxwm8gcHoBO57I2f1DbZBlO152FLQcp6Lf+sd4CAAAA==",
    "200w": "data:image/webp;base64,UklGRj4IAABXRUJQVlA4IDIIAADwMgCdASrIAHEAPm0yk0YkIy8krjMqWeANiWUBhSZB+Dp2dFzyb5YSvcF/5nNf/R73H/X9dnNN9Vn9R6P+xs6C/YbYP/su73tpAF+etNIY0tHVl4JoUXNoBT8RXMzRDHYrNzbyJ/Tp056nFjJJOqTNNVmhYlJg9/gywOQ1ZugkrVqDkhMrgqqLcmPVXP95Xy3/4d4xD1K6F0RTDQe5nWe0PnNYOS7MSKi5bRLfIhMAr69fwSn1Orz4ELNMBirlRFUUVyYsH6Y7k+MDeSMlBZSlVyv5/YI/jft5zdqaSZB/xkOPyttpBEkuoih4AIODdXuVxr63vSyfRAmzu9wGI7VvMn+uHhoNYvUB2NZKetZDnllgEqOBYtuP+l9HKR01R7jYm7U6ajinz1YINYr3wduQrZABFPq2L8lH6mUnCRN0gvLD87OLs8AAsPraSGtsDK0eVQ46Vute+x6joil4+mf+de80lFANf8rFZM/bD2l1zw8fDUXjrZqyibewfP9Gkse1SBXXAw3wJeiHzFVq2xxcyoVxyzxJH4qsZOPPHr8MAADwsYxukIZqgCbv+CHs+VH/pjOcidfq/rAJ1bLiwJBrJlb68VumFAjujmyFYs+8rrXYWTYKlhj1psAg94OIfmRP8GBLGuYwhi8x4e63CRviXp84CfJ4jeJx7JkV85ZKdLiptjlD6z5oBVsv+HejHH6rz6ug6F71j6UOVvY5pR2hmTUotpc6ro7lF5HglWW6lJRVcUCZ56rT+QLQ95QSXXzwlULVG3/pWAl/KuqY9JtrLLfR7AcJPDTnZNnX/006wn9LmjkvZRwu8CPAFL8otp7K6gqQtBJ2LnY5RWwA6WTuidGHikdO4adi0taylw0mBLSJ+ByqIIAALQn1nBdPYaCyi43FTWWJD5Xk9p9vPiWGC7cwBn2KepGFtUm1pTXStz+QRGobHoUSCLE7gVrpD+aKMnYE+iYmk2JYznnSwkmlwirTv/+iePRRMQSt1MCW/5efbkMcRf3P8Tc/V2er+VYCCQ429PZfjfwwoxTq2R/n3ML9TK9Fdn6yX+YyjswUzlttMNOZNwpj2adzg5u1fdLj54vA0EFmtyr0zkuE+pacQ1Bw8Hhpf9jH4Gp5GJUPrGlSb+Us8yR1Hxim8z8EYaHOTF0boazKbv/uYMekBnnmD8HtH1YwD9PGe1PZUYWp7KT1A3iMUI/mbGLgStUmyjmpzp+G06xtQsUzbVqEzXudmC8qaY2Vvgega/UoQQXCoX5KeDzowt1PJnCri9XW/chU+BzhOxpqErsUUD6gfUPrpp5qm/n+v9+ORMXW0Gc03ojWYi7ZK05njITpZR7j/22SEtUERksV0+1ZTiviyRpPpP59l/aWWkuHQqGaiABtmyFvE3HXZRT4VEbuy9UFo8/b2lzhNA+W0VWvMpCZ+U/wtwR4eDoyfFr6wfcFrqxYUWVqF4GzK0fwj9qQyYmVQn5MZ3bwepa8Uptr37EOyDPZKwjUolM1qjPRd/+/KVmjEqpZsoc/hDrmwziZu7RahzV/8QkTy2OxXohiw40pjLRYbCdvksBMGjifAwXQdoqURcIsg+g1xbLM5ZDsjxctRL9J2/8TWvrabXD1VeiXmnBX+84ZaMte14WogxLzWRiUYjNCWzExYA8ZyoWHr0PfkwbnPdGtLfBvNqkJFKjW6MIX+wDILw0bMRjwjKeQ+Pn82WGRGD00BfJDoYrUyQoMQ7Q522ZgU2gIyClw84vUYGvxe82//Hbt39zkk3LJfN1qYgUnKW5ftFxxxxDQKMoHaxvnEPmpRFWELbOKvInlefgJ3EIB29kjeq2jKm2MDZhxiell0rYaOpyYydFuPgcSYwPX1B9EJE4BANBRdNgi+DHJH/WH1cMJSsNSbb+I/SLFOOPDB4LzYr7fN4QN2tZldkCtiijAxO+xAyNG... (line truncated to 2000 chars)",
    "400w": "data:image/webp;base64,UklGRpAUAABXRUJQVlA4IIQUAADQkACdASqQAeEAPm00lEckIzSoKjQKUpANiWU7Tlm1NBceXy0wwS8ddn7dn5Xby27+tXi2/Y53/6vez9PvMz9W/9E6PK8rfTYwjbyh2mN9XersKsPn+WjPQLc+CauxZqPbK4PMf/Xpyi6uZDlTzgcwxHXJV/g/gUe0VAIqgcJABZDIy0+UuJ57xvTqoIipyBTvGuKvXcyHnnd33X5IcNnCPPBXpGWTYj5SvAX+Elr6xtYn6vXQKQsbOOOJ4fK90AcW+FGi0xA7Kbh8Ja9y5e44l/mCX+Qb6kIHVa/XEoL2sJjAjAL5u8SfULWxVxBb3LkeQckT7ZX5FWqV3p8ubdu/Njt/ytinJ1JfRXJiljbtUNM28ju7u0IWM/6mz3bq4tkzOWG0L/y0GN6btNiFXT75FfIW55B7fT9h2t/OT2WROfQReqHrx2Iclx+7Rvjxpk4eaLqmCrCSLxx6b6XYoFokcZopf3wUYlHQIXtaGkOxareeh6HiJ2gqLJWlFRhnCIfNFrrdXeZYD+z4IWnoJlRsi0TsoUndb5JyiAVKRuNLlO8nEnPcqLYQnfduhya78ZqcviCZTZl5vATG4fDeOgjINF3UVmwTiIMvVi6LLopILecvsWfRB5eXoE8LJyc6UufTbBLyTxMODmoeA4I9Z5hMpkH45R5uW2P7yl5o1DXk/tuug4m9RF6ymtQEW96ThEGV1WE830pvOYCd174D49W0PVFtXiKGyvylWu4h19K0W/l9MN1rom9MSGS1z+pksEncMPN5ty7+XSkfX/RocbXqlHhDHwxpgf2JLGKNFh00U1nUwZN86H9inJ1SDj0F0tB3cDqo9uBKWYVUcIbs0nYELmpY4Gzwq458Vk6oaLfxZ0P2WtP+Z+HMJOBThC1ooiq3zwdPrsbZdfRU9BkW0Px0sSNYJtWSTZabg8+6YxMiOqrer+8PqXZu50A+mMQ6Ns0CTmNvmhTYjTke9gdsRpUkpIbGaWYWL6MTA4/FbLOrA4J5Wd7ddB/Dvj85lkq1k/1/b3OwEzdt5WWKl4KKEzPKn6mQNalnOD99tPA1Gp1mj0a10JOCMDQiUqDsdtm1Jic9n5QiZMUYi8N7oFPhY6w/D90ZDPeOctP/yZHi9Nw5WXF2sAjybeA8RAyDXhJxP1KaeBQzHfHsJorv6dyLxfgXs5N5fb6C3zOP1BEQLpyNHfeBC9JJIcLgatY3xBpZuF0WgKSuu5XgK8zZKXmPoad5kpCDOXRFoohHYI5BYPjQW7EwJ1W9li15GvxOzOtJs06LzKjh1fYMxqxsEHMWz8uQJETXB6HsRSgpaoxPQOnnSalaYAAEleN89lrkIqYNAM1WNs9CYmlXmH10ebVNSa3mXmBCpn1onrAjvIjOZCqNORdulzvVjAx+eMsmuYQc/eq3WLojuf3GfB6eUyaAAo91JNoywILWHdoyfOBr+FIzkStD+Jm8jwo5wwEM1sPitDfL3MoQFWOBCbRu2q/Xz9GamTebVZrc8fQZgoR4ov5lpStTJvJMUyZaEqOYygU57oSTFPWxa+KnmBozVUda6AAA/pMq3eUz/m//0s2iyvfh/wv5FbXy6K4UaymNOAD9eEFlHtjFxhbjupyUyfInY0IGnRxiCHF5SrN1d0qici9VPpaqw6M/ASUB6dmdTU7Jis2ghK4Kl1dKjKPCtl7x3NNb5S+VDsO8NHhmW1xTjkcGJo7HjjRXImJX+LgZYaXocBEkg/3PUVODQyJyBncilrGVqOehgJlNcp63AhNPgI2X4LiDEh12GnrTGeOs/EZ6KKpZMNHgQD//++/eaOXiwCIZHFBgRSEcCNOctIevSBRLQGqHY7qrtzubw2adQC6HST2M0x85/hsNlYwFB60+ujtACuXRmb9Rnm8DuUtw9XvdJZuze2sYh2Di1AEAwDV8SsbkHzvjEj9oOjEe... (line truncated to 2000 chars)",
    "800w": "data:image/webp;base64,UklGRlA2AABXRUJQVlA4IEQ2AAAQqgGdASogA8IBPm02lUgkJimnpvPZ6TANiWdL3niL9/QmNE0utaJ/yNs7hs/kymLf/wXXGfzq2fWw4gtBrb60TX+Pbrb5W/2+fH+h//+b/1Fczv1n/0Lo+fP/6f/eq/TKwifzI/N/83/+dcF/z/wvfDsVMSP/AyzM4sA/lubLyB8qfR1rSf/56j/vD1nCckv8q4Fz4NP6JbDaa0TLYk/okKb+j077GujDSkgXPbesrGyRNQJ4bItAoGNDMLSmk76Bc+DVWCg7DEogWl2LSn+jBRqg7Vk4fFF5VR1drpeXHRi8f8dReCG6MRbJlkRvd1v+N2P+gXTWieXZ77PnmzHWoBkEC2LM4A6G6BZIF0ZSy5ohiZBBc/ChbniOJ6TP2sYtjNFf3zMmwGwo8zu7v9X+pMyXSJ/N6ag6MV8gOx7lmpwNwgJO0a+Y1nLetQUutvuCAtFuKQI5sUkcIos4qUdxJ4pD27/Pln5giMES01ROGRCTapjtbiYMpJTpFqB1X5ERgF5biwMqjU8Q3mtM5yT2e7bffxwWXoWGlsob2t22+olsd6prkJm00FQ5CAxxH3U1wsR1dP7WrE2QrQc/92M1eNYrGOMZCKVI3Rpa0hRf9uQ034G3L4eojzFL59I0IPuvfLrpOqhr4+znG45iNnMNWEezPl30Rmxh0OOZYs6jSZwGYyx1ylhgnoKBNVc/9N88riWxFbEeuR1RKaaM7ei5hbrRt10xFraX2avSMB2b+wFHhy8jZp68pE/5uV2x/IuTrrNHjQvpEh3cz9Q7SprepFXptQyQoAWfQelqyqjoAgvwZov/Ol8B11Kil/Y9clMEdRmjFEbdKV5bwDCbDN6Dji7wGX6SxpHNlJFpb/mttbVK9Pg0yLFrSgh58ATfdp2zFIoSGtWkiWz5B5V1eroB3DM4BRF/WFRaUY11QNOGkXqSEXGcgs9rwa4+M++ilRq3qP0fjfNa4ME07i7dZOwFDmxQU430thba9gK0sVuFrjYMc6HQN6DqqZ5vlT1emeh9vzLRh8i/Fc34K9tpK6B3aPnRehm2cr49zJ0lOrZlCOZj4V67s6gYrrDhI+lSwrpXbWzat6y2P9tzKx+RsQmBZe2Bi0j/eEAKRnvOBZ/JE2lHgy0lbtxuqt2FX03Or16uzvGF3gZq4EYxv6c0J6d6LP8U3maxXEfdNHjJBl+3ofE0ENJktl5IiYN6rRPNE+TbQB1l/8ldCNNgWB7G0UDL1RAkp1Jv9CzcmXfPInEMF4OAic1KjYLooWjLbIVIy2POmsTt6PrWgUc+en/L+tjJZk3KQWQyNu/e2XuzmXmsWG4A/qv8I5ZvUA+Qgy4cW6JDUmGw2acd5L6d8QZTbhEQh3gPzHbbef3kiFnjTK1+k5HmACuRUsZUL4m3JoAGOnHrjCIevMGGR3eWxk9bkVNv5KCzExIZB7VmTPFwR1ZnRGzeUUIzivlWE3Y3beOQer5iAObV0w4iEg/bMQUKPAix9UeuZ3SGgcHN+g3H2G1dd/XTTkitr002Xfsvbrd1mv/JFY+WGl+TLiJGa+gQaQspAibXDfuw4umf7eASudYK4FSlxMfCfYXOFisaqg9igVx1tBv7xS1LN9fMllw8NC98S/legCDIYmtW2Q9t3EFAtrYUOXKkJ7JhxqFZ/0n6gQkkdmpzw+YuPUmfBoQvuN0YdDfMA6giizXNbPomlvJTTdD8fpZsTAv26VyAKbGyxEWgxtqyur2cY9n9Rb04lBo9O+O8w65ed/p6fRZfg74X9+Og7TOYaB9WZy/EFr6xaiZoLHa1DnB7DIBQJXbd24cYyfa2PEOHO63tlYYL0pABZ6UK32EB8SEh+aMxLnmfuhq0Q1ekr7bgsCNiAFWQiwN7+jJf0RPTDx5Ab4ot2RAC9wdYgsAEwQMLSdytsXiL3A/sbvG3l8xwIwoU... (line truncated to 2000 chars)",
    "1200w": "data:image/webp;base64,UklGRh5cAABXRUJQVlA4IBJcAAAQLgOdASqwBKMCPm02lkgkKSylpbT52ZANiWduluw9hfw59RumpfsZPCx1RhYeYTqHUt/oKP9n8XPu78TxVvS/9Z0zX+t4dXfP+F6SHq950n+ht6k+WznxHo5JB48PrZcn/OH/n+L7XWfH9Ri2f/+Xv2R8xX14fyLo3bL5x8v5H/8PRT80/2fFH89/b/+vtLZW/0u8X/vcsbPM/7/9vRg1XjxKaH4NR/sxv/96yPvT06yMZHHxHW+Vs+AQ6eQwohsMAEofjPL/Z9DPft2Nd4B2X2rCyPlbPgDje23hdA9toN2AdwpH/iHyd6XpdKt4sjmUd6VJ8rO90BVslgVUp9zSOldcgMeZw0e9ve0L2rZ+qkpa0H+7OHnXhP9tLvc4sfqsxpGaCJlB32XDQCrubqWfev7IhkP9pMfWf+8rd+Ug5pmGS1RWEojpb4CdhQTWiV/ur46DRkO/7UsmNwY+B9DL1YyJMBRW+e3PbIO552prurnv7Lwqr+D9COs//CH74LAog8K7PQDKPiwPDd6FcktaRi6KGuVsz5PPXcAZKty5xnxJs7QZQK5/SWkjRbN4yGz+nEA7j/N5K2f15be2hcKk3Il+ILW55SmSIcSpUbVWDU/AMZW/HO5j4euFJqC1sVerI6paQADw2amuk4T4ZA2oTw4vYw8QZHz9QYLI4xiENVpMg/mM6VjNaHhXEpGO0lxnibr5K9ZlU4a0uYEBKti8sktkIoXdwAd6sow6P1O0JJtsfFRBshm+yLiRLK3DCrY6yALJnZ7wR1TrWdA2rsl/qqd2M889fY7iR5kpL7Jcsm0k1pM0sMxy4DzcrTAL70gQNgVlutlCpLp9ehyzX/GD0asrvRc2BpQ0l5fv9XrnwMdP9kn8Mjj4jDCwfW92rWE5k+vvZV5A6YPRlMNfJpGQn81M0DhczD1B5smqduDGp39tAZSUiJmzS/eEXHcjfuGjbTl/w2KSzuTXHsSJoOM8zkFzMvaPKjXSB9ZOn/WiX8pB7zoo8ntYA2hdPkJ6g7IVx6vGlBeryvVaA94++Qkf353mwS71B/l/eQ/yknTsIZa4E8JLh4A0oqGmd2vaWVQifrm72NxW+szv8Ig9UpKTNYT1Jlv+2kxpzaG1atgH6ZEf2joGwF0yx8LoxtUPnaGnOaIxTAhxuOyK7V4eYKfhGjfHUvSd8D7mrRuZNGrDsQbk3lKB1qLIc8Z+iLlM2D+5bHxiwPvPHQCMe7Fx3mUT8W4PzKI1cwUAmJ3612ATSpQk7/tOhXJ/74TMeb5DJR/jMYRLIpQFFPcPTmflJ2QXXttiQNdy5lpGuwrZr/SjZS0S9mqKF3LiLqwYtwfYHTtkVLfEKGnAmsfEDl3asAZFE7RwBuX+v0N1HOw4l2QFz8ITVAxjmAQeqoYhtDAco1+FqMUGNiM0f5qeueMnCqywL5OwVPHnmTnOECcFmskZsmsL4eXsGmCnkpaVEXXaKPL1EGe8R7AxZopDkKJWamNP9vbtivKYIAbXNj33AkMhesC+DRYYNi5VSd0WWMRNgQ/UQbgobvY5TsIQUJxYnrs9ZHkPSErXhyKjexdYVn89c1IPR39i5j63V80WsZJ8CjYPugrQDUFb9MkkyT3JiM6B7auZgOVGsD4KVWxyANrwcys3YkAky4gT9Xcm5GBj2CiPdMVlpTaqrjymAAhiNEho45U8DpRz8ExEO7B0D1XBLjx/VaAQMth6x7KqPHzDgruU7bQLcdiz3xsNtrxrUWAhIneTHGvyiZpJFEhUtCgmXa0n/scTH+yWSENVlig4pFZ/Dyywy2EacCxeeql/jyNkk772mxJKWYSuJKdfvw1lsWO7x2IiXmr52MyS0e9N/MN8ILS0oE68D5jtwj+Ib5DwXUH+pPmQqu15NcIGhPzt88Q1hqHqRC4xRXBkHLvpWKFpivetwyRq18G... (line truncated to 2000 chars)",
  },
}

const seedData: SeedCommunityPost[] = [
  // User 0 — Budi Santoso (4 posts)
  {
    userIndex: 0,
    title: "Selada saya mulai menguning, ada yang tahu penyebabnya?",
    body: "Halo teman-teman, selada hidroponik saya yang sudah berusia 3 minggu mulai menguning di bagian tepi daun. Saya pakai sistem NFT dengan nutrisi AB mix. pH saya jaga di 6.0, TDS sekitar 900 ppm. Apa mungkin kekurangan zat besi atau malah kelebihan cahaya? Lampu LED saya 12 jam sehari. Mohon pencerahannya.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 0,
    title: "Hasil panen minggu ini: 2kg selada + 1kg bayam!",
    body: "Alhamdulillah, minggu ini panen cukup melimpah. Selada kriting saya total 2kg dan bayam 1kg. Lumayan buat dijual ke tetangga. Sistem DFT buatan sendiri ternyata hasilnya nggak kalah sama produk komersial. Yang mau share pengalaman hasil panennya, silakan!",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 0,
    title: "Review GrowMate setelah 2 bulan pemakaian",
    "body": "Sudah 2 bulan saya pakai GrowMate untuk monitoring hidroponik di rumah. Jujur sangat membantu terutama fitur notifikasi otomatisnya. Kemarin sensor kelembaban sempat error tapi setelah dikalibrasi ulang normal lagi. Semoga ke depannya ada fitur integrasi dengan smart home.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 0,
    title: "Tips mengatasi jamur di rockwool",
    body: "Beberapa hari lalu rockwool saya muncul bercak hijau seperti lumut. Ternyata karena kelembaban terlalu tinggi dan sirkulasi udara kurang. Cara saya atasi: kurangi volume nutrisi, kasih kipas angin kecil, dan bersihkan rockwool yang terkena jamur. Seminggu kemudian bersih kembali.",
    image: SHARED_POST_IMAGE,
  },

  // User 1 — Sri Wahyuni (2 posts)
  {
    userIndex: 1,
    title: "Bibit kemangi saya kok lama tumbuhnya?",
    body: "Sudah 10 hari sejak semai, bibit kemangi saya baru muncul 2 lembar daun dan pertumbuhannya lambat banget. Suhu rata-rata 28°C, kelembaban 60%. Apa karena cuaca sedang panas atau ada yang salah dengan media semainya?",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 1,
    title: "Akhirnya panen cabai rawit setelah 3 bulan! 🎉",
    body: "Setelah menunggu 3 bulan lebih, akhirnya cabai rawit saya berbuah dan siap panen. Rasanya puas banget lihat hasil jerih payah sendiri. Dari satu tanaman dapat sekitar 200 gram. Lumayan buat stok dapur. Yang mau mulai tanam cabai, sabar ya, hasilnya sepadai!",
    image: SHARED_POST_IMAGE,
  },

  // User 2 — Agus Prasetyo (2 posts)
  {
    userIndex: 2,
    title: "Ada yang pakai sistem DFT? Share pengalaman dong",
    body: "Saya lagi pertimbangan beralih dari sistem wick ke DFT. Kelihatannya lebih efisien dan air nutrisi lebih terjaga. Tapi saya masih ragu soal biaya listrik untuk pompa yang nyala 24 jam. Ada yang sudah pakai DFT? Bagaimana pengalaman kalian?",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 2,
    title: "Cara bersihin pompa yang benar gimana?",
    body: "Pompa akuarium yang saya pakai untuk nutrisi mulai tersumbat. Sudah saya bongkar dan sikat pakai sikat gigi bekas, tapi masih kurang bersih. Ada yang punya tips cara bersihin pompa hidroponik yang benar? Takut rusak kalau salah bongkar.",
    image: SHARED_POST_IMAGE,
  },

  // User 3 — Dewi Sartika (4 posts)
  {
    userIndex: 3,
    title: "pH nutrisi naik turun terus, bagaimana cara stabilkan?",
    body: "Dalam seminggu terakhir pH nutrisi saya fluktuatif antara 5.2 sampai 7.0. Padahal sudah pakai pH down dan up bergantian. Setelah saya cek, ternyata sumber air saya dari sumur yang kandungan mineralnya tinggi. Solusinya saya ganti pakai air reverse osmosis. Sekarang pH lebih stabil di 6.0-6.5.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 3,
    title: "Tomat ceri saya berbongkol-bongkol, kenapa ya?",
    body: "Tomat ceri yang saya tanam hidroponik bentuknya aneh, berbongkol-bongkol tidak mulus. Setelah riset, ternyata itu gejala blossom end rot karena kekurangan kalsium. Saya tambah suplemen kalsium dan atur kelembaban lebih stabil. Buah baru sudah mulai mulus.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 3,
    title: "Rekomendasi merk nutrisi AB mix yang bagus",
    body: "Selama ini saya pakai nutrisi AB mix merek A, hasilnya lumayan. Tapi pengen coba merek lain yang mungkin lebih bagus atau lebih hemat. Ada rekomendasi? Budget sekitar 100-150rb per liter pekat. Yang penting cocok untuk sayuran daun dan buah.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 3,
    title: "Cara mengatasi kutu daun pada tanaman hidroponik",
    body: "Kemarin tanaman bayam saya terserang kutu daun. Saya semprot pakai air sabun ringan, ternyata cukup efektif. Lalu saya tambah predator alami berupa ladybug yang saya beli online. Seminggu kemudian kutu hilang. Jangan langsung pakai pestisida kimia ya.",
    image: SHARED_POST_IMAGE,
  },

  // User 4 — CV Tani Makmur (2 posts)
  {
    userIndex: 4,
    title: "Kami buka kelas hidroponik gratis tiap Sabtu",
    body: "Halo teman-teman grower, CV Tani Makmur mau ngadain kelas hidroponik gratis setiap hari Sabtu pukul 10.00-12.00 di showroom kami Bandung. Materi dari dasar sampai mahir. Yang berminat bisa daftar via DM. Yuk belajar bareng!",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 4,
    title: "Promo nutrisi AB mix dan rockwool murah meriah",
    body: "Bulan ini ada promo untuk member GrowMate: nutrisi AB mix 1 liter pekat hanya 85rb dan rockwool cube 50 pcs hanya 25rb. Khusus 50 pembeli pertama. Kunjungi toko kami di Shopee atau datang langsung ke gerai CV Tani Makmur. Buruan sebelum kehabisan!",
    image: SHARED_POST_IMAGE,
  },

  // User 5 — Hendra Gunawan (2 posts)
  {
    userIndex: 5,
    title: "Suhu di Semarang panas banget, tanaman jadi layu",
    body: "Semarang lagi panas-panasnya, suhu bisa sampai 35°C di siang hari. Tanaman selada saya jadi layu-layu meskipun nutrisi cukup. Saya coba pasang paranet 50% dan kipas angin, agak mendingan. Ada tips lain buat yang tinggal di daerah panas?",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 5,
    title: "Perbandingan hidroponik NFT vs DFT untuk pemula",
    body: "Setelah setahun main hidroponik, saya coba rangkum perbandingan NFT dan DFT: NFT lebih irit listrik karena pompa cukup nyala 30 menit per jam, tapi resiko mati listrik bikin tanaman cepat layu. DFT lebih stabil karena air nutrisi menggenang, tapi pompa harus 24 jam. Kalau budget pas-pasan, mulai aja dari wick system dulu.",
    image: SHARED_POST_IMAGE,
  },

  // User 6 — Rina Kusuma (4 posts)
  {
    userIndex: 6,
    title: "Bogor lagi hujan terus, tanaman saya overwater",
    body: "Hujan udah seminggu nggak berhenti di Bogor. Tanaman hidroponik outdoor saya kena air hujan berlebih. Beberapa akar mulai membusuk. Saya pindahkan ke tempat teduh dan kurangi sirkulasi nutrisi. Ada yang punya pengalaman serupa?",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 6,
    title: "Baby greens pertama saya! Mikrogreen kacang hijau",
    body: "Baru pertama coba tanam microgreen kacang hijau. Cuma 5 hari udah siap panen! Rasanya segar banget buat campuran salad. Anak-anak juga suka lihat proses tumbuhnya. Recommended buat yang mau berkebun instan.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 6,
    title: "Sensor GrowMate saya mati total, ada solusi?",
    body: "Tiba-tiba sensor GrowMate yang saya pakai untuk monitor kelembaban mati total, nggak ada indikator sama sekali. Udah ganti baterai, reset, tetap mati. Ada yang pernah ngalamin? Cara klaim garansi gimana ya?",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 6,
    title: "Tanaman sawi pagoda saya tumbuh subur!",
    body: "Sawi pagoda atau tatsoi ternyata cocok banget buat hidroponik. Pertumbuhannya cepat dan nggak gampang layu. Dari semai sampai panen cuma 25 hari. Rasanya manis dan renyah. Wajib coba buat yang suka sayuran unik!",
    image: SHARED_POST_IMAGE,
  },

  // User 7 — PT Hijau Lestari (2 posts)
  {
    userIndex: 7,
    title: "Lowongan kerja: teknisi hidroponik skala industri",
    body: "PT Hijau Lestari membuka lowongan untuk teknisi hidroponik dengan pengalaman minimal 2 tahun. Penempatan Jakarta. Kami mengelola greenhouse seluas 2 hektar dengan sistem NFT. Jika berminat silakan kirim CV ke hr@hijaulestari.co.id.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 7,
    title: "Hasil panen greenhouse kami bulan ini capai 5 ton!",
    body: "Bulan ini greenhouse PT Hijau Lestari berhasil memanen total 5 ton sayuran organik yang terdiri dari selada, bayam, pakcoy, dan kangkung. Semua dikirim ke supermarket mitra di Jakarta. Target bulan depan 6 ton. Terus berkembang!",
    image: SHARED_POST_IMAGE,
  },

  // User 8 — Eko Purnomo (2 posts)
  {
    userIndex: 8,
    title: "Saya bingung milih sistem hidroponik yang cocok",
    body: "Halo semua, saya pemula banget di hidroponik. Bingung milih antara sistem wick, NFT, atau DFT. Budget saya terbatas dan lahan cuma 2x3 meter di belakang rumah. Lebih recomended yang mana untuk pemula dengan budget minim? Makasih.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 8,
    title: "Tips menyemai benih sayuran yang benar",
    body: "Setelah beberapa kali gagal semai, akhirnya saya menemukan cara yang tepat: rendam benih 2-4 jam sebelum semai, gunakan rockwool yang sudah dibasahi pH 5.5-6.0, letakkan di tempat teduh, dan jaga kelembaban dengan spray. Sekarang hampir 90% benih saya tumbuh.",
    image: SHARED_POST_IMAGE,
  },

  // User 9 — Maya Anggraini (4 posts)
  {
    userIndex: 9,
    title: "Hidroponik di Denpasar dengan cuaca panas",
    body: "Di Denpasar suhu rata-rata 30-33°C. Awalnya saya ragu bisa hidroponik di sini. Tapi setelah coba, ternyata tanaman selada dan kangkung tetap tumbuh subur asal cukup air dan naungan. Yang penting jangan sampai kekeringan.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 9,
    title: "Bikin sistem hidroponik vertikal dari pipa PVC",
    body: "Habiskan akhir pekan bikin sistem hidroponik vertikal dari pipa PVC 3 inch. Biaya total cuma 200rb termasuk pompa. Bisa tanam 24 tanaman sekaligus. Hemat tempat banget buat di balkon. Kalian mau tutorialnya?",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 9,
    title: "Tanaman hias monstera saya kok busuk akar?",
    body: "Monstera yang saya tanam di air (hidroponik) tiba-tiba akarnya busuk dan daun menguning. Ternyata saya jarang ganti air dan kotoran menumpuk. Sekarang saya rutin ganti air setiap 3 hari dan kasih nutrisi khusus tanaman hias. Mulai pulih!",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 9,
    title: "Jadwal penyiraman otomatis pakai timer ala saya",
    body: "Buat yang males nyiram manual, saya pakai timer listrik 30rb-an yang dipasang ke pompa. Seting nyala 15 menit setiap 4 jam. Sangat membantu apalagi kalau lagi keluar kota. Tanaman tetap terawat meski ditinggal 3-4 hari.",
    image: SHARED_POST_IMAGE,
  },

  // User 10 — Adi Nugroho (2 posts)
  {
    userIndex: 10,
    title: "Medan panas dan lembab, hidroponik indoor lebih aman",
    body: "Cuaca Medan yang panas dan lembab bikin tanaman outdoor rentan penyakit. Saya pindah ke indoor dengan lampu LED 30W dan kipas sirkulasi. Hasilnya lebih terkontrol dan tanaman lebih sehat. Walau listrik naik dikit, worth it.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 10,
    title: "Pertumbuhan tanaman saya lambat, apa kurang cahaya?",
    body: "Tanaman pakcoy saya tumbuh lambat padahal nutrisi dan pH sudah sesuai. Setelah saya ukur intensitas cahaya dengan GrowMate, ternyata cuma 30% di bawah ideal 50%. Sekarang saya tambah lampu LED dan pertumbuhan langsung cepat.",
    image: SHARED_POST_IMAGE,
  },

  // User 11 — Fitri Handayani (3 posts)
  {
    userIndex: 11,
    title: "Trik menanam stroberi hidroponik di dataran rendah",
    body: "Stroberi biasanya susah berbuah di dataran rendah. Tapi setelah coba teknik tertentu akhirnya berhasil juga. Kuncinya: atur suhu tetap 20-25°C pakai AC, beri nutrisi tinggi kalium saat berbunga, dan pastikan sirkulasi udara baik. Hasilnya manis!",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 11,
    title: "Nutrisi AB mix habis, bisa bikin sendiri?",
    body: "Karena lagi irit, saya coba bikin nutrisi hidroponik sendiri dari pupuk NPK dan KNO3 yang dijual di toko pertanian. Resepnya dapat dari YouTube. Hasilnya lumayan, tanaman tumbuh tapi kurang optimal dibanding AB mix pabrikan. Tetap lebih recommended beli yang jadi.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 11,
    title: "Panen kangkung hidroponik tiap 2 minggu sekali",
    body: "Kangkung adalah tanaman paling cepat panen buat hidroponik. Cuma 15-20 hari udah siap potong. Dan bisa dipotong berkali-kali! Tinggal sisakan 2 ruas batang, nanti tumbuh lagi. Sekarang saya tanam kangkung rutin buat stok sayur harian.",
    image: SHARED_POST_IMAGE,
  },

  // User 12 — CV Alam Segar (4 posts)
  {
    userIndex: 12,
    title: "Kami jual perlengkapan hidroponik lengkap di Tangerang",
    body: "Buat teman-teman yang butuh perlengkapan hidroponik, CV Alam Segar di Tangerang sediakan: pipa PVC, pompa, netpot, rockwool, nutrisi AB mix, pH meter, TDS meter, dan perlengkapan lainnya. Harga bersahabat. Bisa kirim ke seluruh Indonesia via JNE.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 12,
    title: "Tips memilih pompa air untuk hidroponik skala rumah",
    body: "Pompa air yang cocok buat hidroponik rumah: untuk 20-30 lubang tanam cukup pompa akuarium 600-1000 L/h. Jangan terlalu besar nanti boros listrik. Kalau untuk sistem DFT, pilih yang head-nya rendah tapi flow tinggi. Recomended: merek Resun atau Atman.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 12,
    title: "Cara kalibrasi pH meter dengan benar",
    body: "Banyak yang pH meter-nya nggak akurat karena jarang dikalibrasi. Caranya gampang: siapkan buffer pH 4.0 dan 7.0, celupkan probe ke buffer 7.0 lalu atur sampai terbaca 7.0, bilas, lalu celup ke buffer 4.0 dan atur sampai 4.0. Lakukan tiap 2 minggu sekali.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 12,
    title: "Kenapa tanaman hidroponik harus pakai netpot?",
    body: "Netpot itu penting karena fungsinya sebagai dudukan tanaman sekaligus menjaga akar tetap terendam nutrisi. Pilih netpot yang sesuai ukuran lubang tanam. Jangan terlalu longgar nanti tanamannya miring. Standar pakai diameter 5 cm untuk sayuran daun.",
    image: SHARED_POST_IMAGE,
  },

  // User 13 — Reza Fahlevi (2 posts)
  {
    userIndex: 13,
    title: "Palembang sering banjir, hidroponik solusi bertani",
    body: "Di Palembang yang sering banjir, lahan pertanian konvensional susah. Saya beralih ke hidroponik dan hasilnya memuaskan. Nggak perlu khawatir kebanjiran karena sistemnya di atas tanah. Selada dan kangkung jadi andalan saya.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 13,
    title: "Cara membuat larutan nutrisi hidroponik yang benar",
    body: "Buat yang baru mulai, cara buat nutrisi itu simpel: siapkan air bersih 10 liter, masukkan nutrisi A 5ml, aduk rata, lalu nutrisi B 5ml, aduk lagi. Diamkan 5 menit, cek pH dan TDS. Jangan campur A dan B dalam keadaan pekat ya! Bisa menggumpal.",
    image: SHARED_POST_IMAGE,
  },

  // User 14 — Intan Permatasari (3 posts)
  {
    userIndex: 14,
    title: "Saya mau ningkatin estetika taman hidroponik",
    body: "Selain fungsional, saya juga mau taman hidroponik di rumah kelihatan cantik. Ada yang punya referensi desain? Saya suka yang minimalis dengan pipa PVC putih dan pot warna-warni. Mungkin bisa pakai rak kayu biar lebih natural look.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 14,
    title: "Tips mengatasi daun keriting pada cabai hidroponik",
    body: "Daun cabai saya keriting-keriting dan ada bercak kuning. Setelah diteliti, ternyata serangan thrips. Saya semprot pakai insektisida organik dari bawang putih dan cabai. Seminggu kemudian daun baru tumbuh normal.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 14,
    title: "Budget 500rb cukup buat mulai hidroponik?",
    body: "Buat yang mau mulai hidroponik dengan budget 500rb, cukup kok! Beli pipa PVC 3 batang (150rb), pompa akuarium (100rb), netpot 20 pcs (30rb), rockwool (25rb), nutrisi AB mix (100rb), dan sisanya buat benih dan perlengkapan kecil. Sisa 50rb buat takjil.",
    image: SHARED_POST_IMAGE,
  },

  // User 15 — Dwi Cahyo (4 posts)
  {
    userIndex: 15,
    title: "Malang dingin, tanaman hidroponik saya subur banget",
    body: "Tinggal di Malang yang udaranya sejuk ternyata cocok buat hidroponik. Suhu rata-rata 20-25°C tanpa AC. Tanaman selada, pakcoy, dan bayam tumbuh super subur. Panen bisa lebih cepat 5-7 hari dari estimasi normal. Worth it!",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 15,
    title: "Saya buat sistem hidroponik dari barang bekas",
    body: "Dari pada beli baru, saya bikin sistem hidroponik dari botol bekas 1.5 liter. Dipotong jadi dua, dibalik, jadi pot sekaligus reservoir. Bisa bikin 20 botol gratis. Cuma beli nutrisi dan rockwool aja. Sangat ekonomis untuk belajar.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 15,
    title: "TDS meter murah apakah akurat?",
    body: "Saya beli TDS meter 30rb dari marketplace. Setelah dibandingkan dengan TDS meter teman yang harganya 200rb, selisihnya cuma 10-20 ppm. Lumayan akurat untuk kebutuhan sehari-hari. Tapi pastikan dikalibrasi pakai larutan standar ya.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 15,
    title: "Jenis sayuran yang cocok untuk hidroponik outdoor",
    body: "Kalau mau tanam outdoor, pilih sayuran yang tahan panas: kangkung, bayam, sawi hijau, dan selada romaine. Hindari selada butterhead yang mudah layu kena panas. Kangkung yang paling kuat, hampir nggak pernah gagal.",
    image: SHARED_POST_IMAGE,
  },

  // User 16 — Putu Wirawan (3 posts)
  {
    userIndex: 16,
    title: "Hidroponik di lahan miring? Bisa banget!",
    body: "Lahan saya miring tapi saya tetap bisa bikin hidroponik dengan sistem DFT yang diratakan. Kuncinya: buat meja atau rak yang rata pakai waterpass. Saya pakai rak besi hollow bekas, murah meriah. Jangan biarkan lahan miring jadi halangan.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 16,
    title: "Ciri-ciri tanaman hidroponik kekurangan nutrisi",
    body: "Belajar dari pengalaman, tanaman yang kekurangan nutrisi punya ciri: daun kuning (kurang N), batang ungu (kurang P), tepi daun kering (kurang K), daun keriput (kurang Mg), dan pertumbuhan kerdil (defisiensi umum). Segera tambah dosis nutrisi.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 16,
    title: "Starter kit hidroponik untuk kado teman",
    body: "Bingung mau kadoin teman? Saya bikin starter kit hidroponik: 1 box berisi netpot 5 pcs, rockwool 10 pcs, nutrisi AB mix ukuran kecil, benih selada, dan panduan tanam. Total cuma 100rb. Kado yang unik dan bermanfaat!",
    image: SHARED_POST_IMAGE,
  },

  // User 17 — PT Bumi Hijau (3 posts)
  {
    userIndex: 17,
    title: "Kami bangun greenhouse hidroponik di Surabaya",
    body: "PT Bumi Hijau sedang membangun greenhouse hidroponik modern di area Surabaya Barat. Seluas 5000 m2 dengan sistem NFT dan irigasi otomatis. Proyek ini akan menyerap 20 tenaga kerja lokal. Target panen perdana bulan depan.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 17,
    title: "Kerja sama dengan petani lokal untuk suplai nutrisi",
    body: "Kami buka kerja sama dengan petani hidroponik lokal untuk suplai nutrisi AB mix dengan harga khusus. Minimum order 20 liter. Kami juga sediakan pelatihan gratis cara penggunaan yang benar. Hubungi kami untuk informasi lebih lanjut.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 17,
    title: "Update proyek greenhouse: sudah 80% selesai",
    body: "Progres greenhouse kami sudah 80%. Tinggal pemasangan sistem irigasi dan pengaturan sensor GrowMate. Berikut foto-foto perkembangannya. Semoga bulan depan sudah bisa panen perdana. Terima kasih atas dukungannya!",
    image: SHARED_POST_IMAGE,
  },

  // User 18 — Nina Zahra (4 posts)
  {
    userIndex: 18,
    title: "Bogor basah, tips hindari jamur di tanaman hidroponik",
    body: "Bogor yang lembab bikin jamur gampang tumbuh. Tips dari saya: pastikan sirkulasi udara cukup pakai kipas, jangan terlalu rapat tanaman, dan bersihkan bagian yang terkena jamur segera. Saya juga semprot fungisida organik seminggu sekali.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 18,
    title: "Cara membuat pestisida alami dari daun pepaya",
    body: "Daun pepaya ternyata bisa jadi pestisida alami yang ampuh. Caranya: tumbuk 5 lembar daun pepaya, campur dengan 1 liter air, diamkan semalaman, saring, lalu semprotkan ke tanaman. Efektif untuk mencegah ulat dan kutu daun.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 18,
    title: "GrowMate saya bermasalah, minta tolong dong",
    body: "Halo tim GrowMate, aplikasi saya tiba-tiba nggak bisa connect ke sensor. Sudah restart HP dan cabut pasang sensor, tetap error. Padahal kemarin masih normal. Mohon bantuannya, tanaman saya butuh monitoring soalnya.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 18,
    title: "Beberapa jenis selada yang wajib dicoba",
    body: "Selada itu banyak jenisnya yang cocok hidroponik: selada kriting (crisphead), selada romaine (cos), selada butterhead, dan selada daun merah (lollo rosso). Favorit saya romaine karena renyah dan manis. Cobain semua untuk variasi!",
    image: SHARED_POST_IMAGE,
  },

  // User 19 — Ari Wibowo (4 posts)
  {
    userIndex: 19,
    title: "Yogyakarta kota yang cocok buat hidroponik pemula",
    body: "Dengan suhu rata-rata 26-30°C, Yogyakarta cocok banget buat hidroponik. Banyak komunitasnya juga. Saya bergabung dengan grup hidroponik Jogja yang aktif banget. Tiap bulan ada gathering dan tukar tanaman. Seru!",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 19,
    title: "Terima kasih GrowMate, panen saya meningkat 40%",
    body: "Sebelum pakai GrowMate, panen saya sering gagal karena overwatering atau kekurangan nutrisi. Setelah pakai sensor dan notifikasi, hasil panen naik 40% dalam 2 bulan. Biaya listrik juga lebih efisien karena pompa nyala sesuai kebutuhan. Recommended!",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 19,
    title: "Cara mudah deteksi hama pada tanaman hidroponik",
    body: "Deteksi dini hama itu penting. Cek setiap hari bagian bawah daun, biasanya hama bersembunyi di situ. Tanda-tanda: bintik putih (kutu kebul), sarang laba-laba (tungau), lubang kecil (ulak), atau daun menggulung (thrips). Semakin cepat ditangani semakin baik.",
    image: SHARED_POST_IMAGE,
  },
  {
    userIndex: 19,
    title: "Berkebun hidroponik sebagai terapi stres",
    body: "Siapa sangka berkebun hidroponik ternyata ampuh buat ngilangin stres. Setiap hari lihat tanaman tumbuh dan berkembang bikin hati tenang. Ditambah lagi bisa panen sayuran segar sendiri. Dua manfaat sekaligus: kesehatan mental dan pangan organik.",
    image: SHARED_POST_IMAGE,
  },
]

export default seedData
